import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { effectiveWeeksBetween } from '@/lib/calendar-breaks';

export interface CourseProgress {
  workload: number;
  weeklyHours: number;
  hoursPerSession: number;
  hoursCompleted: number;
  hoursRemaining: number;
  lessonsRemaining: number;
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
        .in('id', ids);
      return data || [];
    },
  });

  const { data: schedules } = useQuery({
    queryKey: ['progress_schedules', schoolId, ids],
    enabled: !!schoolId && ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_schedules')
        .select('student_course_id, time_slot_id, time_slots(start_time, end_time)')
        .eq('school_id', schoolId!)
        .in('student_course_id', ids);
      return data || [];
    },
  });

  const studentIds = useMemo(() => [...new Set((scs ?? []).map((s: any) => s.student_id))], [scs]);

  const { data: attendance } = useQuery({
    queryKey: ['progress_attendance', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, time_slot_id, status')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .eq('status', 'present');
      return data || [];
    },
  });

  return useMemo<Record<string, CourseProgress>>(() => {
    if (!scs || !schedules || !attendance) return {};
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // schedules grouped by sc id
    const schedBySc: Record<string, { weeklyHours: number; sessions: number; slotHoursMap: Record<string, number>; slotIds: Set<string> }> = {};
    schedules.forEach((r: any) => {
      const k = r.student_course_id;
      if (!k) return;
      if (!schedBySc[k]) schedBySc[k] = { weeklyHours: 0, sessions: 0, slotHoursMap: {}, slotIds: new Set() };
      const h = slotHours(r.time_slots?.start_time, r.time_slots?.end_time);
      schedBySc[k].weeklyHours += h;
      schedBySc[k].sessions += 1;
      if (r.time_slot_id) {
        schedBySc[k].slotIds.add(r.time_slot_id);
        schedBySc[k].slotHoursMap[r.time_slot_id] = h;
      }
    });

    // attendance by student
    const attByStudent: Record<string, { time_slot_id: string }[]> = {};
    attendance.forEach((a: any) => {
      if (!attByStudent[a.student_id]) attByStudent[a.student_id] = [];
      attByStudent[a.student_id].push({ time_slot_id: a.time_slot_id });
    });

    const result: Record<string, CourseProgress> = {};
    (scs as any[]).forEach(sc => {
      const sched = schedBySc[sc.id];
      const weeklyHours = sched?.weeklyHours ?? 0;
      const sessions = sched?.sessions ?? 0;
      const hps = Math.max(sessions > 0 ? weeklyHours / sessions : 1, 1);
      const slotIds = sched?.slotIds ?? new Set<string>();

      let realHours = 0;
      (attByStudent[sc.student_id] ?? []).forEach(a => {
        if (a.time_slot_id && slotIds.has(a.time_slot_id)) {
          realHours += sched!.slotHoursMap[a.time_slot_id] ?? hps;
        }
      });

      let estimated = 0;
      const start = parseDate(sc.first_class_date || sc.enrollment_date);
      if (start && weeklyHours > 0) {
        const wks = effectiveWeeksBetween(start, today);
        estimated = Math.min(wks * weeklyHours, sc.workload || 48);
      }
      const workload = sc.workload || 48;
      const hoursCompleted = Math.max(realHours, estimated);
      const hoursRemaining = Math.max(workload - hoursCompleted, 0);
      const lessonsRemaining = Math.ceil(hoursRemaining / hps);
      result[sc.id] = {
        workload,
        weeklyHours,
        hoursPerSession: hps,
        hoursCompleted: Math.round(hoursCompleted * 10) / 10,
        hoursRemaining: Math.round(hoursRemaining * 10) / 10,
        lessonsRemaining,
      };
    });
    return result;
  }, [scs, schedules, attendance]);
}
