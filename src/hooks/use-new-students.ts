import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';

export interface NewStudentEntry {
  studentId: string;
  studentCourseId: string;
  fullName: string;
  courseName: string;
  startDate: string | null;          // ISO yyyy-Mm-dd
  startDateFormatted: string;        // dd/MM/yyyy
  isFutureStart: boolean;
  schedules: { day_of_week: string; start_time: string; end_time: string }[];
}

export const parseAnyDate = (v: string | null | undefined): Date | null => {
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

export const toIsoDate = (v: string | null | undefined): string | null => {
  const d = parseAnyDate(v);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatBR = (v: string | null | undefined): string => {
  const d = parseAnyDate(v);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/**
 * Returns the list of active student_courses considered "new":
 * - The course has at least one start date defined (first_class_date or enrollment_date)
 * - AND the student has zero 'present' attendance rows yet (in any time slot of this course)
 *
 * Once a presence is registered, the entry disappears automatically.
 */
export function useNewStudents() {
  const { schoolId } = useSchool();

  return useQuery<NewStudentEntry[]>({
    queryKey: ['new_students', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      // 1. Active student_courses with student info
      const { data: scs, error } = await (supabase as any)
        .from('student_courses')
        .select('id, student_id, first_class_date, enrollment_date, custom_course_name, courses(name), students(id, full_name)')
        .eq('school_id', schoolId!)
        .eq('is_active', true);
      if (error) throw error;

      const list = (scs ?? []).filter((sc: any) => !!sc.students);
      if (list.length === 0) return [];

      const scIds = list.map((sc: any) => sc.id);
      const studentIds = [...new Set(list.map((sc: any) => sc.student_id as string))] as string[];

      // 2. Schedules per student_course
      const { data: schedRows } = await supabase
        .from('student_schedules')
        .select('student_course_id, time_slots(day_of_week, start_time, end_time)')
        .eq('school_id', schoolId!)
        .in('student_course_id', scIds);
      const schedMap: Record<string, { day_of_week: string; start_time: string; end_time: string }[]> = {};
      (schedRows ?? []).forEach((r: any) => {
        if (!r.time_slots) return;
        if (!schedMap[r.student_course_id]) schedMap[r.student_course_id] = [];
        schedMap[r.student_course_id].push(r.time_slots);
      });

      // 3. Students that already have at least one presence
      const { data: attRows } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .eq('status', 'present')
        .limit(5000);
      const hasPresence = new Set<string>();
      (attRows ?? []).forEach((r: any) => hasPresence.add(r.student_id));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return list
        .filter((sc: any) => {
          if (hasPresence.has(sc.student_id)) return false;
          const d = parseAnyDate(sc.first_class_date || sc.enrollment_date);
          return !!d;
        })
        .map((sc: any) => {
          const d = parseAnyDate(sc.first_class_date || sc.enrollment_date)!;
          return {
            studentId: sc.student_id,
            studentCourseId: sc.id,
            fullName: sc.students.full_name || 'Sem nome',
            courseName: sc.courses?.name || sc.custom_course_name || 'N/A',
            startDate: toIsoDate(sc.first_class_date || sc.enrollment_date),
            startDateFormatted: formatBR(sc.first_class_date || sc.enrollment_date),
            isFutureStart: d.getTime() > today.getTime(),
            schedules: schedMap[sc.id] ?? [],
          };
        })
        .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    },
  });
}
