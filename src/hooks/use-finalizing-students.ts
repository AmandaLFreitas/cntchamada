import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStudents } from '@/hooks/use-supabase-data';
import { useSchool } from '@/contexts/SchoolContext';
import { effectiveWeeksBetween, addEffectiveWeeks } from '@/lib/calendar-breaks';

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

const slotHours = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 1;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max((eh + em / 60) - (sh + sm / 60), 1);
};

export function useFinalizingStudents() {
  const { schoolId } = useSchool();
  const { data: students } = useStudents(true);

  const studentIds = useMemo(() => (students ?? []).map((s: any) => s.id), [students]);

  // Schedules per student_course — keyed by student_course_id (per-course isolation)
  const { data: courseSchedules } = useQuery({
    queryKey: ['course_schedules_finalizing', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_schedules')
        .select('student_id, student_course_id, time_slot_id, time_slots(start_time, end_time)')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds);

      // Map: student_course_id -> { weeklyHours, sessions, slotIds: Set, slotHours: Record<slotId, hours> }
      const map: Record<string, {
        weeklyHours: number;
        sessions: number;
        slotIds: Set<string>;
        slotHours: Record<string, number>;
      }> = {};

      data?.forEach((r: any) => {
        const scId = r.student_course_id;
        if (!scId) return;
        if (!map[scId]) map[scId] = { weeklyHours: 0, sessions: 0, slotIds: new Set(), slotHours: {} };
        const h = slotHours(r.time_slots?.start_time, r.time_slots?.end_time);
        map[scId].weeklyHours += h;
        map[scId].sessions += 1;
        if (r.time_slot_id) {
          map[scId].slotIds.add(r.time_slot_id);
          map[scId].slotHours[r.time_slot_id] = h;
        }
      });
      return map;
    },
  });

  // Real attendance — fetched once, then bucketed per student_course using slotIds
  const { data: attendanceByStudent } = useQuery({
    queryKey: ['attendance_for_finalizing', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, time_slot_id, status')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .eq('status', 'present');
      // student_id -> array of { time_slot_id }
      const map: Record<string, { time_slot_id: string }[]> = {};
      data?.forEach((r: any) => {
        if (!map[r.student_id]) map[r.student_id] = [];
        map[r.student_id].push({ time_slot_id: r.time_slot_id });
      });
      return map;
    },
  });

  const finalizing = useMemo<FinalizingStudent[]>(() => {
    if (!students || !courseSchedules || !attendanceByStudent) return [];
    const result: FinalizingStudent[] = [];
    const seen = new Set<string>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (students as any[]).forEach(s => {
      const activeCourses = (s.student_courses ?? []).filter((sc: any) => sc.is_active);
      const studentAttendance = attendanceByStudent[s.id] ?? [];

      activeCourses.forEach((sc: any) => {
        if (seen.has(sc.id)) return;
        seen.add(sc.id);

        const courseSched = courseSchedules[sc.id];
        const weeklyHours = courseSched?.weeklyHours ?? 0;
        const sessions = courseSched?.sessions ?? 0;
        const slotHoursMap = courseSched?.slotHours ?? {};
        const courseSlotIds = courseSched?.slotIds ?? new Set<string>();

        const hoursPerSession = sessions > 0 ? weeklyHours / sessions : 1;
        const effectiveHoursPerSession = Math.max(hoursPerSession, 1);

        // PER-COURSE attendance: count only presences in this course's time slots,
        // and weight each by the actual slot duration (so 1h Excel + 1h Design same
        // day yields exactly 1h per course, never summed).
        let realHoursCompleted = 0;
        studentAttendance.forEach(a => {
          if (a.time_slot_id && courseSlotIds.has(a.time_slot_id)) {
            realHoursCompleted += slotHoursMap[a.time_slot_id] ?? effectiveHoursPerSession;
          }
        });

        const workload = sc.workload || 48;
        const realPct = workload > 0 ? (realHoursCompleted / workload) * 100 : 0;

        // Estimated progress — uses this course's own weekly frequency, skipping breaks
        const startDate = parseDate(sc.first_class_date || sc.enrollment_date);
        let estimatedHoursCompleted = 0;
        let estimatedPct = 0;
        if (startDate && weeklyHours > 0) {
          const weeksElapsed = effectiveWeeksBetween(startDate, today);
          estimatedHoursCompleted = Math.min(weeksElapsed * weeklyHours, workload);
          estimatedPct = workload > 0 ? (estimatedHoursCompleted / workload) * 100 : 0;
        }

        // Use higher of real vs estimated (real wins when tied)
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

          // Expected end — derived from this course's weekly frequency.
          // Examples (workload 48h, 1h/session):
          //   1x/week (1h/wk)  → 48 weeks ≈ 12 months
          //   2x/week (2h/wk)  → 24 weeks ≈ 6 months
          //   3x/week (3h/wk)  → 16 weeks ≈ 4.5 months
          //   4x/week (4h/wk)  → 12 weeks ≈ 3 months
          let expectedEnd: Date | null = null;
          if (startDate && weeklyHours > 0) {
            const totalWeeksNeeded = workload / weeklyHours;
            expectedEnd = addEffectiveWeeks(startDate, totalWeeksNeeded);
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
  }, [students, courseSchedules, attendanceByStudent]);

  return finalizing;
}
