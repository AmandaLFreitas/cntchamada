import { useMemo } from 'react';
import { useStudents } from '@/hooks/use-supabase-data';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';

export function CourseCompletionAlert() {
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
          result.push({
            name: s.full_name || 'Sem nome',
            course: sc.courses?.name || sc.custom_course_name || 'N/A',
            pct,
          });
        }
      });
    });

    return result;
  }, [students, attendanceCounts, scheduleCounts]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
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
