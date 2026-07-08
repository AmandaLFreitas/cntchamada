// Shared helpers to aggregate attendance BY DAY.
// Rule: a student can have at most 1 falta per date, regardless of how many
// classes (time slots) they had that day.
//
// Per-day status resolution (for a given student on a given date):
//   - 'present'  if ANY record that day is 'present'
//   - 'absent'   if no 'present' and AT LEAST ONE 'absent'
//   - 'neutral'  otherwise (only 'neutral' records)

export type AttendanceStatus = 'present' | 'absent' | 'neutral';

export interface RawAttendanceRow {
  student_id?: string;
  date: string;
  status: string;
  is_justified?: boolean | null;
  absence_note?: string | null;
}

export interface DayAggregate {
  date: string;
  status: AttendanceStatus;
  isJustified: boolean;
  note: string | null;
}

/**
 * Aggregate a flat list of attendance rows into one entry per (student, date).
 * Returns a map keyed by `${student_id}|${date}` when rows contain student_id,
 * otherwise keyed just by date (single-student scope).
 */
export function aggregateAttendanceByDay(rows: RawAttendanceRow[]): DayAggregate[] {
  const byKey = new Map<string, {
    date: string;
    hasPresent: boolean;
    hasAbsent: boolean;
    justified: boolean; // true only if every absent that day is justified
    absentCount: number;
    justifiedAbsentCount: number;
    notes: string[];
  }>();

  for (const r of rows) {
    if (!r || !r.date) continue;
    const key = `${r.student_id ?? '_'}|${r.date}`;
    const cur = byKey.get(key) || {
      date: r.date,
      hasPresent: false,
      hasAbsent: false,
      justified: true,
      absentCount: 0,
      justifiedAbsentCount: 0,
      notes: [] as string[],
    };
    if (r.status === 'present') cur.hasPresent = true;
    else if (r.status === 'absent') {
      cur.hasAbsent = true;
      cur.absentCount += 1;
      if (r.is_justified) cur.justifiedAbsentCount += 1;
      if (r.absence_note && r.absence_note.trim()) cur.notes.push(r.absence_note.trim());
    }
    byKey.set(key, cur);
  }

  return Array.from(byKey.entries()).map(([key, v]) => {
    let status: AttendanceStatus = 'neutral';
    if (v.hasPresent) status = 'present';
    else if (v.hasAbsent) status = 'absent';
    // Justified only meaningful for absent days: all absences on that day marked as justified
    const isJustified = status === 'absent'
      ? v.absentCount > 0 && v.justifiedAbsentCount === v.absentCount
      : false;
    const note = v.notes.length > 0 ? Array.from(new Set(v.notes)).join(' | ') : null;
    return { date: v.date, status, isJustified, note };
  });
}
