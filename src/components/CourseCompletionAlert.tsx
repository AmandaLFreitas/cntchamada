import { useMemo, useState } from 'react';
import { useStudents } from '@/hooks/use-supabase-data';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, X, ChevronUp } from 'lucide-react';

export function CourseCompletionAlert() {
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const { data: students } = useStudents(true);

  const studentIds = useMemo(() => (students ?? []).map((s: any) => s.id), [students]);

  const { data: attendanceCounts } = useQuery({
    queryKey: ['attendance_counts_all', studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status')
        .in('student_id', studentIds)
        .eq('status', 'present');
      const map: Record<string, number> = {};
      data?.forEach(r => {
        map[r.student_id] = (map[r.student_id] || 0) + 1;
      });
      return map;
    },
  });

  const { data: scheduleCounts } = useQuery({
    queryKey: ['schedule_hours_all', studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_schedules')
        .select('student_id, time_slots(start_time, end_time)')
        .in('student_id', studentIds);
      const map: Record<string, number> = {};
      data?.forEach((r: any) => {
        if (!map[r.student_id]) map[r.student_id] = 0;
        if (r.time_slots) {
          const start = r.time_slots.start_time?.split(':').map(Number) ?? [0, 0];
          const end = r.time_slots.end_time?.split(':').map(Number) ?? [0, 0];
          const hours = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
          map[r.student_id] += Math.max(hours, 1);
        }
      });
      return map;
    },
  });

  const alerts = useMemo(() => {
    if (!students || !attendanceCounts || !scheduleCounts) return [];
    const result: { name: string; course: string; pct: number }[] = [];

    (students as any[]).forEach(s => {
      (s.student_courses ?? []).filter((sc: any) => sc.is_active).forEach((sc: any) => {
        const presences = attendanceCounts[s.id] || 0;
        const hoursPerSession = (scheduleCounts[s.id] || 1) / Math.max(Object.keys(s.student_courses?.filter((c: any) => c.is_active) || {}).length, 1);
        const hoursCompleted = presences * Math.max(hoursPerSession, 1);
        const workload = sc.workload || 48;
        const pct = Math.round((hoursCompleted / workload) * 100);

        if (pct >= 80 && pct < 100) {
          const remainingHours = Math.max(workload - hoursCompleted, 0);
          const aulasRestantes = Math.ceil(remainingHours / Math.max(hoursPerSession, 1));
          result.push({
            name: s.full_name || 'Sem nome',
            course: sc.courses?.name || sc.custom_course_name || 'N/A',
            pct,
            aulasRestantes,
          });
        }
      });
    });

    return result;
  }, [students, attendanceCounts, scheduleCounts]);

  if (alerts.length === 0 || dismissed) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-20 z-50 bg-yellow-500 text-white rounded-full p-3 shadow-lg hover:bg-yellow-600 transition-colors"
        title="Ver alertas de conclusão"
      >
        <AlertTriangle className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {alerts.length}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-yellow-700">
          <AlertTriangle className="h-4 w-4" /> Alunos finalizando curso
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-yellow-500/20 rounded">
            <ChevronUp className="h-3.5 w-3.5 text-yellow-700" />
          </button>
          <button onClick={() => setDismissed(true)} className="p-1 hover:bg-yellow-500/20 rounded">
            <X className="h-3.5 w-3.5 text-yellow-700" />
          </button>
        </div>
      </div>
      {alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-3 border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{a.name}</span> está finalizando o curso de{' '}
            <span className="font-semibold">{a.course}</span> ({a.pct}% concluído)
          </p>
        </div>
      ))}
    </div>
  );
}
