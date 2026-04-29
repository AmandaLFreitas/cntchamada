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
  source: 'real' | 'estimated';
}

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
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

  // Real attendance (presences only)
  const { data: attendanceCounts } = useQuery({
    queryKey: ['attendance_counts_finalizing', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status, date')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .eq('status', 'present');
      const map: Record<string, { count: number; firstDate: string | null }> = {};
      data?.forEach(r => {
        if (!map[r.student_id]) map[r.student_id] = { count: 0, firstDate: null };
        map[r.student_id].count += 1;
        if (!map[r.student_id].firstDate || r.date < map[r.student_id].firstDate!) {
          map[r.student_id].firstDate = r.date;
        }
      });
      return map;
    },
  });

  // Schedule hours per week per student
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
    const seen = new Set<string>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (students as any[]).forEach(s => {
      const activeCourses = (s.student_courses ?? []).filter((sc: any) => sc.is_active);
      activeCourses.forEach((sc: any) => {
        if (seen.has(sc.id)) return;
        seen.add(sc.id);

        const attendance = attendanceCounts[s.id] || { count: 0, firstDate: null };
        const sched = scheduleHours[s.id] || { totalHours: 0, sessions: 0 };
        const hoursPerSession = sched.sessions > 0 ? sched.totalHours / sched.sessions : 1;
        const effectiveHoursPerSession = Math.max(hoursPerSession, 1);
        const weeklyHours = sched.totalHours; // total hours per week from schedule
        const workload = sc.workload || 48;

        const startDate = parseDate(sc.first_class_date || sc.enrollment_date);

        // Real progress (CASE 1) — based on actual presences
        const realHoursCompleted = attendance.count * effectiveHoursPerSession;
        const realPct = workload > 0 ? (realHoursCompleted / workload) * 100 : 0;

        // Estimated progress (CASE 2) — based on time elapsed since start + weekly schedule
        let estimatedHoursCompleted = 0;
        let estimatedPct = 0;
        if (startDate && weeklyHours > 0) {
          const msPerWeek = 7 * 24 * 60 * 60 * 1000;
          const weeksElapsed = Math.max((today.getTime() - startDate.getTime()) / msPerWeek, 0);
          estimatedHoursCompleted = Math.min(weeksElapsed * weeklyHours, workload);
          estimatedPct = workload > 0 ? (estimatedHoursCompleted / workload) * 100 : 0;
        }

        // Use the higher of real vs estimated to avoid blocking calculation when
        // attendance history is incomplete. Real takes priority when it's higher.
        let hoursCompleted: number;
        let pct: number;
        let source: 'real' | 'estimated';
        if (realPct >= estimatedPct) {
          hoursCompleted = realHoursCompleted;
          pct = realPct;
          source = 'real';
        } else {
          hoursCompleted = estimatedHoursCompleted;
          pct = estimatedPct;
          source = 'estimated';
        }

        const pctRounded = Math.round(pct);

        if (pctRounded >= 80 && pctRounded < 100) {
          const hoursRemaining = Math.max(workload - hoursCompleted, 0);
          const lessonsRemaining = Math.ceil(hoursRemaining / effectiveHoursPerSession);

          let expectedEnd: Date | null = null;
          if (startDate && weeklyHours > 0) {
            const weeks = workload / weeklyHours;
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
            pct: pctRounded,
            source,
          });
        }
      });
    });

    return result.sort((a, b) => b.pct - a.pct);
  }, [students, attendanceCounts, scheduleHours]);

  return finalizing;
}
