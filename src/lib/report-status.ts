export const REPORT_STATUSES = ['em_andamento', 'finalizado', 'desistiu'] as const;
export type ReportStatus = typeof REPORT_STATUSES[number];
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  em_andamento: 'Em Andamento', finalizado: 'Finalizado', desistiu: 'Desistente',
};

export function classifyReportStatus(value: unknown): ReportStatus | null {
  return REPORT_STATUSES.find(status => status === value) ?? null;
}

export interface ReportEnrollment {
  id: string;
  student_id: string;
  school_id: string;
  status: string;
  workload: number;
  enrollment_date: string | null;
  first_class_date: string | null;
  custom_course_name: string | null;
  students: { id: string; school_id: string; full_name: string | null; birth_date: string | null; cpf?: string | null; street?: string | null; house_number?: string | null; phone?: string | null; guardian_name?: string | null; guardian_phone?: string | null } | null;
  courses: { name: string } | null;
}

export function groupReportEnrollments(enrollments: ReportEnrollment[], schoolId: string) {
  const groups: Record<ReportStatus, Map<string, NonNullable<ReportEnrollment['students']> & { enrollments: ReportEnrollment[] }>> = {
    em_andamento: new Map(), finalizado: new Map(), desistiu: new Map(),
  };
  for (const enrollment of enrollments) {
    const status = classifyReportStatus(enrollment.status);
    const student = enrollment.students;
    if (!status || !student || enrollment.school_id !== schoolId || student.school_id !== schoolId || student.id !== enrollment.student_id) continue;
    const existing = groups[status].get(student.id);
    if (existing) {
      if (!existing.enrollments.some(item => item.id === enrollment.id)) existing.enrollments.push(enrollment);
    } else groups[status].set(student.id, { ...student, enrollments: [enrollment] });
  }
  const studentsByStatus = Object.fromEntries(REPORT_STATUSES.map(status => [status,
    [...groups[status].values()].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR')),
  ])) as Record<ReportStatus, Array<NonNullable<ReportEnrollment['students']> & { enrollments: ReportEnrollment[] }>>;
  return { studentsByStatus, statusCounts: {
    em_andamento: groups.em_andamento.size, finalizado: groups.finalizado.size, desistiu: groups.desistiu.size,
  } };
}

export const reportCourseName = (enrollment: ReportEnrollment) => enrollment.courses?.name || enrollment.custom_course_name || 'Sem curso';