import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { enrollmentProgress, fetchEnrollmentAttendance } from '@/lib/enrollment-attendance';

export interface CourseProgress {
  workload: number;
  weeklyHours: number;
  hoursPerSession: number;
  hoursPerDay: number;
  hoursCompleted: number;
  hoursRemaining: number;
  lessonsRemaining: number;
  daysRemaining: number;
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

const slotHours = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 1;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max((eh + em / 60) - (sh + sm / 60), 1);
};

export function useCoursesProgress(studentCourseIds: string[]) {
  const { schoolId } = useSchool();
  const ids = useMemo(() => [...new Set(studentCourseIds.filter(Boolean))], [studentCourseIds]);

  const { data: scs } = useQuery({
    queryKey: ['progress_scs', schoolId, ids],
    enabled: !!schoolId && ids.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('student_courses')
        .select('id, student_id, workload, first_class_date, enrollment_date')
        .eq('school_id', schoolId ?? '').in('id', ids);
      return data || [];
    },
  });

  const { data: schedules } = useQuery({
    queryKey: ['progress_schedules', schoolId, ids],
    enabled: !!schoolId && ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_schedules')
        .select('student_course_id, time_slot_id, time_slots(start_time, end_time, day_of_week)')
        .eq('school_id', schoolId ?? '')
        .in('student_course_id', ids);
      return data || [];
    },

  });

  const studentIds = useMemo<string[]>(() => Array.from(new Set((scs ?? []).map((s: any) => s.student_id as string))), [scs]);

  const { data: attendance } = useQuery({
    queryKey: ['progress_attendance', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      if (!schoolId) return [];
      return fetchEnrollmentAttendance(schoolId);
    },
  });

  return useMemo<Record<string, CourseProgress>>(() => {
    if (!scs || !schedules || !attendance) return {};
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // schedules grouped by sc id
    const schedBySc: Record<string, { weeklyHours: number; sessions: number; days: Set<string>; slotHoursMap: Record<string, number>; slotIds: Set<string> }> = {};
    schedules.forEach((r: any) => {
      const k = r.student_course_id;
      if (!k) return;
      if (!schedBySc[k]) schedBySc[k] = { weeklyHours: 0, sessions: 0, days: new Set(), slotHoursMap: {}, slotIds: new Set() };
      const h = slotHours(r.time_slots?.start_time, r.time_slots?.end_time);
      schedBySc[k].weeklyHours += h;
      schedBySc[k].sessions += 1;
      if (r.time_slots?.day_of_week) schedBySc[k].days.add(r.time_slots.day_of_week);
      if (r.time_slot_id) {
        schedBySc[k].slotIds.add(r.time_slot_id);
        schedBySc[k].slotHoursMap[r.time_slot_id] = h;
      }
    });

    const result: Record<string, CourseProgress> = {};
    (scs as any[]).forEach(sc => {
      const sched = schedBySc[sc.id];
      const weeklyHours = sched?.weeklyHours ?? 0;
      const sessions = sched?.sessions ?? 0;
      const distinctDays = Math.max(sched?.days.size ?? 0, 1);
      const hps = Math.max(sessions > 0 ? weeklyHours / sessions : 1, 1);
      const hoursPerDay = Math.max(weeklyHours / distinctDays, hps);
      const slotIds = sched?.slotIds ?? new Set<string>();

      const workload = sc.workload || 48;
      const { hoursCompleted } = enrollmentProgress(attendance, sc.id, workload, sc.enrollment_date);
      const hoursRemaining = Math.max(workload - hoursCompleted, 0);
      const lessonsRemaining = Math.ceil(hoursRemaining / hps);
      const daysRemaining = Math.ceil(hoursRemaining / hoursPerDay);
      result[sc.id] = {
        workload,
        weeklyHours,
        hoursPerSession: hps,
        hoursPerDay,
        hoursCompleted: Math.round(hoursCompleted * 10) / 10,
        hoursRemaining: Math.round(hoursRemaining * 10) / 10,
        lessonsRemaining,
        daysRemaining,
      };
    });
    return result;
  }, [scs, schedules, attendance]);
}

