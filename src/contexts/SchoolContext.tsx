import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export interface School {
  id: string;
  name: string;
  slug: string;
}

interface SchoolContextType {
  schools: School[];
  schoolId: string | null;
  school: School | null;
  setSchoolId: (id: string) => void;
  loading: boolean;
}

const STORAGE_KEY = 'cnt.activeSchoolId';

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [allowedIds, setAllowedIds] = useState<Set<string> | null>(null); // null => no auth filter yet
  const [schoolId, setSchoolIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  // Load all schools once (public read)
  useEffect(() => {
    let mounted = true;
    supabase
      .from('schools')
      .select('id, name, slug')
      .order('name')
      .then(({ data }) => {
        if (!mounted) return;
        setAllSchools((data ?? []) as School[]);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // Track auth and load user-allowed schools
  useEffect(() => {
    const loadAllowed = async (userId: string | null) => {
      if (!userId) {
        setAllowedIds(null);
        return;
      }
      const { data } = await supabase
        .from('user_schools')
        .select('school_id')
        .eq('user_id', userId);
      const ids = new Set<string>((data ?? []).map((r: any) => r.school_id));
      setAllowedIds(ids);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadAllowed(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => loadAllowed(session?.user?.id ?? null), 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Restrict visible list to allowed schools when authenticated
  const schools = allowedIds
    ? allSchools.filter(s => allowedIds.has(s.id))
    : allSchools;

  // Validate stored schoolId against the (filtered) list
  useEffect(() => {
    if (loading) return;
    if (allowedIds === null) return; // not yet authenticated; do not clear
    if (schoolId && !schools.some(s => s.id === schoolId)) {
      localStorage.removeItem(STORAGE_KEY);
      setSchoolIdState(null);
      qc.invalidateQueries();
    }
  }, [loading, allowedIds, schoolId, schools, qc]);

  const setSchoolId = (id: string) => {
    if (id === schoolId) return;
    // Block selecting a school the user cannot access
    if (allowedIds && !allowedIds.has(id)) return;
    localStorage.setItem(STORAGE_KEY, id);
    setSchoolIdState(id);
    qc.invalidateQueries();
  };

  const school = schools.find(s => s.id === schoolId) ?? null;

  return (
    <SchoolContext.Provider value={{ schools, schoolId, school, setSchoolId, loading }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used within SchoolProvider');
  return ctx;
}

/** Throws if no school selected — used inside mutations/queries that need school_id */
export function requireSchoolId(schoolId: string | null): string {
  if (!schoolId) throw new Error('Nenhuma unidade selecionada');
  return schoolId;
}
