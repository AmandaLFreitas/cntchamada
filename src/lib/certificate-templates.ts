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

    'Informática básica': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Informática Básica, com carga horária total de ${d.workload} horas, abrangendo os módulos de digitação, sistema operacional Windows, editor de texto (Word), planilha eletrônica (Excel), apresentação de slides (PowerPoint) e Internet.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Programação KIDS - SCRATCH': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Programação Kids (Scratch), com carga horária total de ${d.workload} horas, abrangendo os módulos de lógica de programação, Scratch, criação de jogos e animações, e introdução ao pensamento computacional.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Lógica de Programação - JAVA': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Lógica de Programação em Java, com carga horária total de ${d.workload} horas, abrangendo os módulos de lógica de programação, orientação a objetos, estrutura de dados, e desenvolvimento de aplicações em Java.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Auxiliar administrativo': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Auxiliar Administrativo, com carga horária total de ${d.workload} horas, abrangendo os módulos de rotinas administrativas, atendimento ao cliente, organização de documentos, informática aplicada e noções de contabilidade.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Auxiliar contabil': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Auxiliar Contábil, com carga horária total de ${d.workload} horas, abrangendo os módulos de contabilidade básica, escrituração, demonstrações contábeis, legislação fiscal e informática aplicada.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Excel avançado': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Excel Avançado, com carga horária total de ${d.workload} horas, abrangendo os módulos de fórmulas avançadas, tabelas dinâmicas, macros, gráficos e análise de dados.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Design grafico': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Design Gráfico, com carga horária total de ${d.workload} horas, abrangendo os módulos de teoria das cores, tipografia, edição de imagens, criação de peças gráficas e identidade visual.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Autocad projetos': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de AutoCAD Projetos, com carga horária total de ${d.workload} horas, abrangendo os módulos de desenho técnico, modelagem 2D e 3D, e elaboração de projetos.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Power - BI': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de Power BI, com carga horária total de ${d.workload} horas, abrangendo os módulos de importação de dados, modelagem, criação de dashboards e visualizações interativas.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Sketchup arquitetonico': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de SketchUp Arquitetônico, com carga horária total de ${d.workload} horas, abrangendo os módulos de modelagem 3D, renderização, plantas e projetos arquitetônicos.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,

    'Solidworks projetos': (d) =>
      `Certificamos que ${d.studentName} concluiu com êxito o curso de SolidWorks Projetos, com carga horária total de ${d.workload} horas, abrangendo os módulos de modelagem 3D, montagens, detalhamento técnico e simulações.\n\nPeríodo: ${d.startDate ?? '—'} a ${d.endDate}.`,
  };

  const templateFn = templates[data.courseName];
  if (templateFn) return templateFn(data);

  return `Certificamos que ${data.studentName} concluiu com êxito o curso de ${data.courseName}, com carga horária total de ${data.workload} horas.\n\nPeríodo: ${data.startDate ?? '—'} a ${data.endDate}.`;
}
