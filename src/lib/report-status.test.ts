import { describe, expect, it } from 'vitest';
import { classifyReportStatus, groupReportEnrollments, type ReportEnrollment } from './report-status';

const enrollment = (id: string, studentId: string, status: string, schoolId = 'toledo'): ReportEnrollment => ({
  id, student_id: studentId, school_id: schoolId, status, workload: 48,
  enrollment_date: null, first_class_date: null, custom_course_name: null,
  students: { id: studentId, school_id: schoolId, full_name: studentId, birth_date: null },
  courses: { name: id },
});

describe('report enrollment classification', () => {
  it('does not classify missing or unknown statuses as ongoing', () => {
    for (const value of [null, undefined, '', 'unknown', 'ativo']) expect(classifyReportStatus(value)).toBeNull();
  });
  it('counts unique students per category while preserving all their courses', () => {
    const records = [enrollment('a', 'Isis', 'em_andamento'), enrollment('b', 'Isis', 'em_andamento'),
      enrollment('c', 'Isis', 'finalizado'), enrollment('d', 'Raimundo', 'desistiu'),
      enrollment('e', 'Other', 'finalizado', 'cascavel'), enrollment('f', 'Unknown', 'unknown')];
    const result = groupReportEnrollments(records, 'toledo');
    expect(result.statusCounts).toEqual({ em_andamento: 1, finalizado: 1, desistiu: 1 });
    expect(result.studentsByStatus.em_andamento[0].enrollments.map(sc => sc.id)).toEqual(['a', 'b']);
    expect(result.studentsByStatus.finalizado[0].enrollments[0].id).toBe('c');
  });
  it('includes inactive finished and dropout enrollments', () => {
    const records = [{ ...enrollment('a', 'A', 'finalizado'), is_active: false },
      { ...enrollment('b', 'B', 'desistiu'), is_active: false }];
    expect(groupReportEnrollments(records, 'toledo').statusCounts).toEqual({ em_andamento: 0, finalizado: 1, desistiu: 1 });
  });
  it('reclassifies counts and lists when a course status changes', () => {
    const records = [enrollment('a', 'A', 'em_andamento')];
    records[0].status = 'desistiu';
    const result = groupReportEnrollments(records, 'toledo');
    expect(result.statusCounts).toEqual({ em_andamento: 0, finalizado: 0, desistiu: 1 });
    expect(result.studentsByStatus.em_andamento).toHaveLength(0);
    expect(result.studentsByStatus.desistiu[0].id).toBe('A');
  });
  it('rejects a joined student from another school and duplicate enrollment rows', () => {
    const record = enrollment('a', 'A', 'em_andamento');
    const mismatch = enrollment('b', 'B', 'finalizado');
    if (mismatch.students) mismatch.students.school_id = 'cascavel';
    const result = groupReportEnrollments([record, record, mismatch], 'toledo');
    expect(result.studentsByStatus.em_andamento[0].enrollments).toHaveLength(1);
    expect(result.statusCounts.finalizado).toBe(0);
  });
});