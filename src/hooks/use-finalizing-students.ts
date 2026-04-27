import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStudents } from '@/hooks/use-supabase-data';
import { useSchool } from '@/contexts/SchoolContext';

export interface FinalizingStudent {
  studentId: string;
  studentCourseId: string;
  name: string;
  course: string;
  startDate: string | null;
  expectedEndDate: string | null;
  workload: number;
  hoursCompleted: number;
  hoursRemaining: number;
  lessonsRemaining: number;
  hoursPerSession: number;
  pct: number;
}

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  // Accept dd/mm/yyyy or yyyy-mm-dd
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
};

const formatDate = (d: Date | null): string | null => {
  if (!d) return null;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export function useFinalizingStudents() {
  const { schoolId } = useSchool();
  const { data: students } = useStudents(true);

  const studentIds = useMemo(() => (students ?? []).map((s: any) => s.id), [students]);

  const { data: attendanceCounts } = useQuery({
    queryKey: ['attendance_counts_finalizing', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .eq('status', 'present');
      const map: Record<string, number> = {};
      data?.forEach(r => {
        map[r.student_id] = (map[r.student_id] || 0) + 1;
      });
      return map;
    },
  });

  const { data: scheduleHours } = useQuery({
    queryKey: ['schedule_hours_finalizing', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_schedules')
        .select('student_id, time_slots(start_time, end_time)')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds);
      const map: Record<string, { totalHours: number; sessions: number }> = {};
      data?.forEach((r: any) => {
        if (!map[r.student_id]) map[r.student_id] = { totalHours: 0, sessions: 0 };
        if (r.time_slots) {
          const start = r.time_slots.start_time?.split(':').map(Number) ?? [0, 0];
          const end = r.time_slots.end_time?.split(':').map(Number) ?? [0, 0];
          const hours = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
          map[r.student_id].totalHours += Math.max(hours, 1);
          map[r.student_id].sessions += 1;
        }
      });
      return map;
    },
  });

  const finalizing = useMemo<FinalizingStudent[]>(() => {
    if (!students || !attendanceCounts || !scheduleHours) return [];
    const result: FinalizingStudent[] = [];

    (students as any[]).forEach(s => {
      const activeCourses = (s.student_courses ?? []).filter((sc: any) => sc.is_active);
      activeCourses.forEach((sc: any) => {
        const presences = attendanceCounts[s.id] || 0;
        const sched = scheduleHours[s.id] || { totalHours: 0, sessions: 0 };
        const hoursPerSession = sched.sessions > 0 ? sched.totalHours / sched.sessions : 1;
        const effectiveHoursPerSession = Math.max(hoursPerSession, 1);
        const hoursCompleted = presences * effectiveHoursPerSession;
        const workload = sc.workload || 48;
        const pct = Math.round((hoursCompleted / workload) * 100);

        if (pct >= 80 && pct < 100) {
          const hoursRemaining = Math.max(workload - hoursCompleted, 0);
          const lessonsRemaining = Math.ceil(hoursRemaining / effectiveHoursPerSession);

          // Expected end date: start + (workload / weeklyHours) weeks
          const startDate = parseDate(sc.first_class_date || sc.enrollment_date);
          let expectedEnd: Date | null = null;
          if (startDate && sched.totalHours > 0) {
            const weeks = workload / sched.totalHours;
            expectedEnd = new Date(startDate);
            expectedEnd.setDate(expectedEnd.getDate() + Math.ceil(weeks * 7));
          }

          result.push({
            studentId: s.id,
            studentCourseId: sc.id,
            name: s.full_name || 'Sem nome',
            course: sc.courses?.name || sc.custom_course_name || 'N/A',
            startDate: formatDate(startDate),
            expectedEndDate: formatDate(expectedEnd),
            workload,
            hoursCompleted: Math.round(hoursCompleted * 10) / 10,
            hoursRemaining: Math.round(hoursRemaining * 10) / 10,
            lessonsRemaining,
            hoursPerSession: effectiveHoursPerSession,
            pct,
          });
        }
      });
    });

    return result.sort((a, b) => b.pct - a.pct);
  }, [students, attendanceCounts, scheduleHours]);

  return finalizing;
}
