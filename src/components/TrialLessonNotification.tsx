import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { GraduationCap, X, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface TrialLessonRow {
  id: string;
  student_name: string;
  course: string | null;
  time_slot: string | null;
  lesson_date: string;
  status: string;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const firstName = (full: string) => (full || '').trim().split(/\s+/)[0] || full;

const abbreviateCourse = (course: string | null): string => {
  if (!course) return '—';
  const map: Record<string, string> = {
    'informática básica': 'Inf. Básica',
    'informatica basica': 'Inf. Básica',
    'informática administrativa': 'Inf. Adm.',
    'informatica administrativa': 'Inf. Adm.',
    'excel avançado': 'Excel Av.',
    'excel avancado': 'Excel Av.',
    'lógica de programação - java': 'Lógica JAVA',
    'logica de programacao - java': 'Lógica JAVA',
    'programação kids - scratch': 'Kids Scratch',
    'programacao kids - scratch': 'Kids Scratch',
    'autocad projetos': 'AutoCAD',
    'design gráfico': 'Design Gráf.',
    'design grafico': 'Design Gráf.',
    'power bi': 'Power BI',
    'sketchup': 'SketchUp',
    'solidworks': 'Solid',
  };
  const key = course.trim().toLowerCase();
  if (map[key]) return map[key];
  // Fallback: first 14 chars
  return course.length > 16 ? course.slice(0, 14) + '…' : course;
};

export function TrialLessonNotification() {
  const { schoolId } = useSchool();
  const navigate = useNavigate();
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { data: lessons = [] } = useQuery({
    queryKey: ['trial_lessons_today', schoolId, todayISO()],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_lessons')
        .select('id,student_name,course,time_slot,lesson_date,status')
        .eq('school_id', schoolId!)
        .eq('lesson_date', todayISO());
      if (error) throw error;
      return (data || []) as TrialLessonRow[];
    },
  });

  const todayLessons = useMemo(() => {
    return lessons
      .filter(l => (l.status || '').toUpperCase() !== 'CANCELADO')
      .sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));
  }, [lessons]);

  if (!todayLessons.length || dismissed) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-20 z-50 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-colors"
        title="Aulas experimentais hoje"
      >
        <GraduationCap className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {todayLessons.length}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-20 z-50 w-72 bg-card border shadow-xl rounded-lg overflow-hidden">
      <div className="bg-blue-600 text-white px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => navigate('/experimentais')}
          className="flex items-center gap-2 text-sm font-medium hover:underline"
        >
          <GraduationCap className="h-4 w-4" /> Experimentais hoje
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-blue-700 rounded">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setDismissed(true)} className="p-1 hover:bg-blue-700 rounded">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 text-sm max-h-56 overflow-auto space-y-1.5">
        {todayLessons.map(l => (
          <div key={l.id} className="flex items-center justify-between gap-2 border-b last:border-b-0 pb-1.5 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{firstName(l.student_name)}</p>
              <p className="text-xs text-muted-foreground truncate">{abbreviateCourse(l.course)}</p>
            </div>
            <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">
              {l.time_slot || '--:--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
