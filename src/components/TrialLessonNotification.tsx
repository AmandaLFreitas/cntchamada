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
  const [minimized, setMinimized] = useState(true);

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
      .slice()
      .sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));
  }, [lessons]);

  const needsContactCount = useMemo(
    () => todayLessons.filter(l => {
      const s = (l.status || '').toUpperCase();
      return s === 'NÃO VEIO' || s === 'DESMARCOU';
    }).length,
    [todayLessons]
  );

  if (!todayLessons.length) return null;

  const headerBg = needsContactCount > 0 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700';

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className={`fixed bottom-4 right-20 z-50 text-white rounded-full p-3 shadow-lg transition-colors ${headerBg}`}
        title={needsContactCount > 0 ? `${needsContactCount} aluno(s) precisam de contato` : 'Aulas experimentais hoje'}
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
      <div className={`text-white px-3 py-2 flex items-center justify-between ${needsContactCount > 0 ? 'bg-orange-600' : 'bg-blue-600'}`}>
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
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-blue-700 rounded" title="Fechar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 text-sm max-h-56 overflow-auto space-y-1.5">
        {todayLessons.map(l => {
          const s = (l.status || '').toUpperCase();
          const rowClass =
            s === 'PENDENTE' ? 'bg-[#FFF3CD]/60' :
            s === 'OK' ? 'bg-[#D0E7FF]/60' :
            s === 'OK.FECHOU' ? 'bg-[#D4EDDA]/70' :
            s === 'NÃO VEIO' ? 'bg-[#F8D7DA]/70 border-l-4 border-l-orange-500' :
            s === 'DESMARCOU' ? 'bg-[#E2E3E5]/70 border-l-4 border-l-orange-500' :
            s === 'REMARCOU' ? 'bg-[#E6D6F5]/70' : '';
          const isAlert = s === 'NÃO VEIO' || s === 'DESMARCOU';
          return (
            <div key={l.id} className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${rowClass}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate flex items-center gap-1">
                  {isAlert && <span className="text-orange-600">⚠️</span>}
                  {firstName(l.student_name)}
                </p>
                <p className="text-xs text-muted-foreground truncate">{abbreviateCourse(l.course)}</p>
              </div>
              <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">
                {l.time_slot || '--:--'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
