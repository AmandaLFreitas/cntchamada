export interface FrequencyEnrollment {
  id: string;
  status: string;
  enrollment_date?: string | null;
  created_at?: string;
}

export function enrollmentDate(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

export function currentFrequencyEnrollment(courses: FrequencyEnrollment[]): string {
  return courses.filter(course => course.status === 'em_andamento').sort((a, b) =>
    (enrollmentDate(b.enrollment_date) || b.created_at || '').localeCompare(enrollmentDate(a.enrollment_date) || a.created_at || '')
    || a.id.localeCompare(b.id))[0]?.id || '';
}

export function attendanceInEnrollment(date: string | undefined, start?: string | null): boolean {
  const lower = enrollmentDate(start);
  return !lower || (!!date && date >= lower);
}