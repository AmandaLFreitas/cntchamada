import { describe, expect, it } from 'vitest';
import { enrollmentProgress } from './enrollment-attendance';

describe('Independent enrollment attendance', () => {
  const old = Array.from({ length: 20 }, (_, i) => ({ id: String(i), student_course_id: 'old', status: 'present', recorded_hours: 2 }));
  it('keeps 40 hours and 100% in the old 40-hour course while the new 60-hour course starts at zero', () => {
    expect(enrollmentProgress(old, 'old', 40)).toMatchObject({ hoursCompleted: 40, pct: 100 });
    expect(enrollmentProgress(old, 'new', 60)).toMatchObject({ hoursCompleted: 0, hoursRemaining: 60, pct: 0 });
  });
  it('does not attribute unlinked legacy rows to a new enrollment', () => {
    expect(enrollmentProgress([{ status: 'present', student_course_id: null, recorded_hours: 40 }], 'new', 60).hoursCompleted).toBe(0);
  });
  it('counts only this enrollment actual presence duration, ignoring absences and neutral rows', () => {
    const rows = [...old, { id: 'new1', student_course_id: 'new', status: 'present', recorded_hours: 1.5 },
      { student_course_id: 'new', status: 'absent', recorded_hours: 2 }, { student_course_id: 'new', status: 'neutral', recorded_hours: 2 }];
    expect(enrollmentProgress(rows, 'new', 60)).toMatchObject({ hoursCompleted: 1.5, hoursRemaining: 58.5, pct: 2.5 });
    expect(enrollmentProgress(rows, 'old', 40).hoursCompleted).toBe(40);
  });
  it('does not count the same attendance ID twice', () => {
    expect(enrollmentProgress([old[0], old[0]], 'old', 40).hoursCompleted).toBe(2);
  });
});