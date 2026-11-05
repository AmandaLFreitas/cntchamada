import { supabase } from '@/integrations/supabase/client';
import { attendanceInEnrollment } from '@/lib/frequency-enrollment';

export interface EnrollmentAttendance {
  id?: string;
  student_course_id?: string | null;
  status: string;
  date?: string;
  recorded_hours?: number | null;
  time_slots?: { start_time: string; end_time: string } | null;
}

export function attendanceHours(row: EnrollmentAttendance): number {
  if (row.recorded_hours != null) return Math.max(Number(row.recorded_hours), 0);
  const slot = row.time_slots;
  if (!slot) return 0;
  const minutes = (value: string) => {
    const [hours, mins] = value.split(':').map(Number);
    return hours * 60 + mins;
  };
  const duration = (minutes(slot.end_time) - minutes(slot.start_time)) / 60;
  return Number.isFinite(duration) ? Math.max(duration, 0) : 0;
}

export function enrollmentProgress(rows: EnrollmentAttendance[], enrollmentId: string, workload: number, enrollmentStart?: string | null) {
  const seen = new Set<string>();
  const presences = rows.filter(row => {
    if (row.student_course_id !== enrollmentId || row.status !== 'present' || !attendanceInEnrollment(row.date, enrollmentStart)) return false;
    if (row.id && seen.has(row.id)) return false;
    if (row.id) seen.add(row.id);
    return true;
  });
  const hoursCompleted = presences.reduce((sum, row) => sum + attendanceHours(row), 0);
  return { hoursCompleted, hoursRemaining: Math.max(workload - hoursCompleted, 0),
    pct: workload > 0 ? hoursCompleted / workload * 100 : 0,
    firstPresence: presences.map(row => row.date).filter((date): date is string => !!date).sort()[0] ?? null };
}

export async function fetchEnrollmentAttendance(schoolId: string): Promise<EnrollmentAttendance[]> {
  const rows: EnrollmentAttendance[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('attendance')
      .select('id, student_course_id, recorded_hours, status, date, time_slots(start_time, end_time)')
      .eq('school_id', schoolId).order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}