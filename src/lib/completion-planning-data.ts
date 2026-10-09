import { parse, isValid } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchOverviewWeeklyReport } from '@/lib/overview-weekly-report';
import type { School } from '@/contexts/SchoolContext';

export type PlanningEnrollment = {
  id: string; studentId: string; school: string; name: string; phone: string;
  birthDate: Date | null; course: string; workload: number; completed: number;
  weeklyHours: number; days: string; times: string; enrollmentDate: Date | null;
  startDate: Date | null; firstPresence: Date | null; expectedEnd: Date;
  status: string; observations: string;
};

export function planningDate(value?: string | null): Date | null {
  if (!value) return null;
  const pattern = /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? 'dd/MM/yyyy' : 'yyyy-MM-dd';
  const date = parse(pattern === 'yyyy-MM-dd' ? value.slice(0, 10) : value, pattern, new Date());
  return isValid(date) ? date : null;
}

export function selectPlanningPeriod(rows: PlanningEnrollment[]) {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (row.status !== 'em_andamento' || row.completed >= row.workload ||
      row.expectedEnd < new Date(2026, 0, 1) || row.expectedEnd > new Date(2027, 1, 28) || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).sort((a, b) => a.expectedEnd.getTime() - b.expectedEnd.getTime() || a.name.localeCompare(b.name, 'pt-BR'));
}

async function allRows(factory: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await factory(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function fetchCompletionPlanning(schools: School[], isAdmin: boolean) {
  const perSchool = await Promise.all(schools.map(async school => {
    const enrollmentFields = isAdmin ? 'enrollment_date, first_class_date' : 'first_class_date';
    const [overview, enrollments, observations] = await Promise.all([
      fetchOverviewWeeklyReport(school.id, school.name, school.slug),
      allRows((from, to) => supabase.from('student_courses')
        .select(`id, student_id, school_id, status, ${enrollmentFields}, students(id, school_id, full_name, phone, birth_date), courses(name)`)
        .eq('school_id', school.id).eq('status', 'em_andamento').order('id').range(from, to) as any),
      allRows((from, to) => supabase.from('student_observations').select('student_id, observation')
        .eq('school_id', school.id).order('created_at', { ascending: false }).order('id').range(from, to)),
    ]);
    const [attendance, schedules] = await Promise.all([
      allRows((from, to) => supabase.from('attendance').select('student_id, time_slot_id')
        .eq('school_id', school.id).eq('status', 'present').order('id').range(from, to)),
      allRows((from, to) => supabase.from('student_schedules').select('student_course_id, time_slot_id')
        .eq('school_id', school.id).order('id').range(from, to)),
    ]);
    const forecastMap = new Map(overview.slots.flatMap(slot => slot.students.map(student => [student.studentCourseId, student] as const)));
    const slotMap = new Map(overview.slots.map(slot => [slot.id, slot]));
    const byCourse = new Map<string, Set<string>>();
    for (const schedule of schedules) {
      if (!schedule.student_course_id) continue;
      const ids = byCourse.get(schedule.student_course_id) ?? new Set<string>();
      ids.add(schedule.time_slot_id);
      byCourse.set(schedule.student_course_id, ids);
    }
    const observationsByStudent = new Map<string, string[]>();
    for (const observation of observations) {
      const entries = observationsByStudent.get(observation.student_id) ?? [];
      entries.push(observation.observation);
      observationsByStudent.set(observation.student_id, entries);
    }
    const results: PlanningEnrollment[] = [];
    for (const enrollment of enrollments) {
      const student = enrollment.students;
      const forecast = forecastMap.get(enrollment.id);
      const expectedEnd = planningDate(forecast?.expectedEndDate);
      if (!student || student.school_id !== school.id || student.id !== enrollment.student_id || !forecast || !expectedEnd) continue;
      const ids = byCourse.get(enrollment.id) ?? new Set<string>();
      const courseSlots = overview.slots.filter(slot => ids.has(slot.id));
      let completed = 0;
      for (const presence of attendance) {
        if (presence.student_id !== enrollment.student_id || !ids.has(presence.time_slot_id)) continue;
        const slot = slotMap.get(presence.time_slot_id);
        if (!slot) continue;
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        completed += Math.max((eh * 60 + em - sh * 60 - sm) / 60, 0);
      }
      results.push({
        id: enrollment.id, studentId: student.id, school: school.name,
        name: student.full_name ?? '', phone: student.phone ?? '', birthDate: planningDate(student.birth_date),
        course: enrollment.courses?.name ?? (forecast.course === 'N/A' ? '' : forecast.course),
        workload: forecast.workload, completed, weeklyHours: forecast.weeklyHours,
        days: [...new Set(courseSlots.map(slot => slot.day))].join(', '),
        times: courseSlots.map(slot => `${slot.day}: ${slot.startTime} – ${slot.endTime}`).join('\n'),
        enrollmentDate: isAdmin ? planningDate(enrollment.enrollment_date) : null,
        startDate: planningDate(enrollment.first_class_date), firstPresence: planningDate(forecast.firstPresence),
        expectedEnd, status: enrollment.status, observations: (observationsByStudent.get(student.id) ?? []).join('\n'),
      });
    }
    return results;
  }));
  return selectPlanningPeriod(perSchool.flat());
}