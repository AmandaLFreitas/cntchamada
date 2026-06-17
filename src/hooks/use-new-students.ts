import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';

export interface NewStudentEntry {
  studentId: string;
  studentCourseId: string;
  fullName: string;
  courseName: string;
  schoolName: string;
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
 * Returns students considered "new":
 * - The student has zero 'present' attendance rows in the database.
 *
 * Once a presence is registered, the entry disappears automatically.
 */
export function useNewStudents() {
  const { schoolId, school } = useSchool();

  return useQuery<NewStudentEntry[]>({
    queryKey: ['new_students', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      // 1. Active students in the selected unit
      const { data: students, error } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('school_id', schoolId!)
        .eq('is_active', true);
      if (error) throw error;

      const studentList = students ?? [];
      if (studentList.length === 0) return [];

      const studentIds = studentList.map((s: any) => s.id as string);

      // 2. Students that already have at least one presence
      const { data: attRows } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .eq('status', 'present')
        .limit(5000);
      const hasPresence = new Set<string>();
      (attRows ?? []).forEach((r: any) => hasPresence.add(r.student_id));

      const newStudents = studentList.filter((student: any) => !hasPresence.has(student.id));
      if (newStudents.length === 0) return [];

      const newStudentIds = newStudents.map((student: any) => student.id as string);

      // 3. Courses are only used for display, never to decide if the student is new
      const { data: scs } = await (supabase as any)
        .from('student_courses')
        .select('id, student_id, first_class_date, enrollment_date, custom_course_name, is_active, courses(name)')
        .eq('school_id', schoolId!)
        .in('student_id', newStudentIds);

      const coursesByStudent: Record<string, any[]> = {};
      (scs ?? []).forEach((sc: any) => {
        if (!coursesByStudent[sc.student_id]) coursesByStudent[sc.student_id] = [];
        coursesByStudent[sc.student_id].push(sc);
      });

      const scIds = (scs ?? []).map((sc: any) => sc.id);

      // 4. Schedules are only used for display
      const { data: schedRows } = scIds.length > 0
        ? await supabase
          .from('student_schedules')
          .select('student_course_id, time_slots(day_of_week, start_time, end_time)')
          .eq('school_id', schoolId!)
          .in('student_course_id', scIds)
        : { data: [] as any[] };
      const schedMap: Record<string, { day_of_week: string; start_time: string; end_time: string }[]> = {};
      (schedRows ?? []).forEach((r: any) => {
        if (!r.time_slots) return;
        if (!schedMap[r.student_course_id]) schedMap[r.student_course_id] = [];
        schedMap[r.student_course_id].push(r.time_slots);
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return newStudents
        .map((student: any) => {
          const studentCourses = coursesByStudent[student.id] ?? [];
          const activeCourses = studentCourses.filter((sc: any) => sc.is_active);
          const displayCourses = activeCourses.length > 0 ? activeCourses : studentCourses;
          const firstCourse = displayCourses[0];
          const startValue = firstCourse?.first_class_date || firstCourse?.enrollment_date || null;
          const startDate = parseAnyDate(startValue);
          const courseNames = displayCourses
            .map((sc: any) => sc.courses?.name || sc.custom_course_name)
            .filter(Boolean);
          const schedules = displayCourses.flatMap((sc: any) => schedMap[sc.id] ?? []);
          return {
            studentId: student.id,
            studentCourseId: firstCourse?.id || student.id,
            fullName: student.full_name || 'Sem nome',
            courseName: courseNames.length > 0 ? courseNames.join(', ') : 'N/A',
            schoolName: school?.name || '—',
            startDate: toIsoDate(startValue),
            startDateFormatted: formatBR(startValue),
            isFutureStart: startDate ? startDate.getTime() > today.getTime() : false,
            schedules,
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
  });
}
