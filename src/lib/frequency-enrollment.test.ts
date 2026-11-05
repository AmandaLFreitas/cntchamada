import { describe, it, expect } from 'vitest';
import { currentFrequencyEnrollment, attendanceInEnrollment, enrollmentDate } from './frequency-enrollment';
import { enrollmentProgress } from './enrollment-attendance';

describe('Current enrollment and period', () => {
  it('opens the current enrollment rather than the completed previous course', () => {
    expect(currentFrequencyEnrollment([{ id: 'old', status: 'finalizado', enrollment_date: '01/01/2026' }, { id: 'new', status: 'em_andamento', enrollment_date: '05/11/2026' }])).toBe('new');
  });
  it('keeps multiple active enrollments separate and defaults to the most recent', () => {
    expect(currentFrequencyEnrollment([{ id: 'a', status: 'em_andamento', enrollment_date: '01/10/2026' }, { id: 'b', status: 'em_andamento', enrollment_date: '05/11/2026' }])).toBe('b');
  });
  it('includes the enrollment day and rejects a preceding presence', () => {
    expect(attendanceInEnrollment('2026-11-05', '05/11/2026')).toBe(true);
    expect(attendanceInEnrollment('2026-11-04', '05/11/2026')).toBe(false);
  });
  it('rejects invalid calendar dates rather than inventing dates', () => {
    expect(enrollmentDate('31/02/2026')).toBeNull();
  });
  it('counts the requested three one-hour presences, not absences, neutral or previous dates', () => {
    const rows = ['05','06','11'].map(day => ({ student_course_id: 'new', status: 'present', date: `2026-11-${day}`, recorded_hours: 1 }));
    const result = enrollmentProgress([...rows, { student_course_id:'new',status:'absent',date:'2026-11-10',recorded_hours:1 }, { student_course_id:'new',status:'neutral',date:'2026-11-12',recorded_hours:1 }, { student_course_id:'new',status:'present',date:'2026-11-04',recorded_hours:1 }], 'new', 60, '05/11/2026');
    expect(result).toMatchObject({ hoursCompleted:3,hoursRemaining:57,pct:5 });
  });
});