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
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase
      .from('schools')
      .select('id, name, slug')
      .order('name')
      .then(({ data }) => {
        if (!mounted) return;
        const list = (data ?? []) as School[];
        setSchools(list);
        // Validate stored id; clear if not present anymore
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && !list.some(s => s.id === stored)) {
          localStorage.removeItem(STORAGE_KEY);
          setSchoolIdState(null);
        }
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const setSchoolId = (id: string) => {
    if (id === schoolId) return;
    localStorage.setItem(STORAGE_KEY, id);
    setSchoolIdState(id);
    // Invalidate every query so all data reloads scoped to the new school
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
