export interface CertificateData {
  studentName: string;
  courseName: string;
  workload: number;
  startDate: string | null;
  endDate: string;
}

export function getCertificateTemplate(data: CertificateData): string {
  const templates: Record<string, (d: CertificateData) => string> = {
    'Informática Administrativa': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Informática Administrativa, com carga horária total de ${d.workload} horas, abrangendo os módulos de digitação, editor de texto (Word), planilha eletrônica (Excel), apresentação de slides (PowerPoint), Internet e noções de administração.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Informática Básica': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Informática Básica, com carga horária total de ${d.workload} horas, abrangendo os módulos de digitação, sistema operacional Windows, editor de texto (Word), planilha eletrônica (Excel), apresentação de slides (PowerPoint) e Internet.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Programação Kids': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Programação Kids, com carga horária total de ${d.workload} horas, abrangendo os módulos de lógica de programação, Scratch, criação de jogos e animações, e introdução ao pensamento computacional.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Programação em Java': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Programação em Java, com carga horária total de ${d.workload} horas, abrangendo os módulos de lógica de programação, orientação a objetos, estrutura de dados, e desenvolvimento de aplicações em Java.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,
  };

  const templateFn = templates[data.courseName];
  if (templateFn) return templateFn(data);

  // Default template
  return `Certificamos que ${data.studentName} concluiu com êxito o curso de ${data.courseName}, com carga horária total de ${data.workload} horas.\n\nPeríodo: ${data.startDate ?? '—'} a ${data.endDate}.`;
}
