export interface CertificateData {
  studentName: string;
  courseName: string;
  workload: number;
  startDate: string | null;
  endDate: string;
}

export interface CertificateFields {
  studentName: string;
  courseTitle: string;
  modules: string;
  modalidade: string;
  frequencia: string;
  cargaHoraria: string;
  nota: string;
  startDate: string;
  endDate: string;
  city: string;
  fullDate: string;
}

function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function formatFullDateBR(dateStr: string | null): string {
  if (!dateStr) return '—';
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const month = months[parseInt(parts[1], 10) - 1];
    const year = parts[0];
    return `${String(day).padStart(2, '0')} de ${month} de ${year}`;
  }
  return dateStr;
}

const courseModules: Record<string, { title: string; modules: string }> = {
  'Informática Administrativa': {
    title: 'INFORMÁTICA ADMINISTRATIVA – PACOTE OFFICE',
    modules: '(Windows, Word, Excel, Secretariado, Contabilidade, PowerPoint, Internet, Digitação)',
  },
  'Informática básica': {
    title: 'INFORMÁTICA BÁSICA',
    modules: '(Windows, Word, Excel, PowerPoint, Internet, Digitação)',
  },
  'Programação KIDS - SCRATCH': {
    title: 'PROGRAMAÇÃO NÍVEL I - KIDS (SCRATCH)',
    modules: '',
  },
  'Lógica de Programação - JAVA': {
    title: 'PROGRAMAÇÃO (JAVA)',
    modules: '',
  },
  'Auxiliar administrativo': {
    title: 'AUXILIAR ADMINISTRATIVO',
    modules: '(Rotinas Administrativas, Atendimento ao Cliente, Organização de Documentos, Informática Aplicada, Noções de Contabilidade)',
  },
  'Auxiliar contabil': {
    title: 'AUXILIAR CONTÁBIL',
    modules: '(Contabilidade Básica, Escrituração, Demonstrações Contábeis, Legislação Fiscal, Informática Aplicada)',
  },
  'Excel avançado': {
    title: 'EXCEL AVANÇADO',
    modules: '(Fórmulas Avançadas, Tabelas Dinâmicas, Macros, Gráficos, Análise de Dados)',
  },
  'Design grafico': {
    title: 'DESIGN GRÁFICO',
    modules: '(Teoria das Cores, Tipografia, Edição de Imagens, Criação de Peças Gráficas, Identidade Visual)',
  },
  'Autocad projetos': {
    title: 'AUTOCAD PROJETOS',
    modules: '(Desenho Técnico, Modelagem 2D e 3D, Elaboração de Projetos)',
  },
  'Power - BI': {
    title: 'POWER BI',
    modules: '(Importação de Dados, Modelagem, Criação de Dashboards, Visualizações Interativas)',
  },
  'Sketchup arquitetonico': {
    title: 'SKETCHUP ARQUITETÔNICO',
    modules: '(Modelagem 3D, Renderização, Plantas, Projetos Arquitetônicos)',
  },
  'Solidworks projetos': {
    title: 'SOLIDWORKS PROJETOS',
    modules: '(Modelagem 3D, Montagens, Detalhamento Técnico, Simulações)',
  },
};

export function getCertificateFields(data: CertificateData): CertificateFields {
  const info = courseModules[data.courseName];
  const today = new Date().toISOString().split('T')[0];

  return {
    studentName: data.studentName.toUpperCase(),
    courseTitle: info?.title || data.courseName.toUpperCase(),
    modules: info?.modules || '',
    modalidade: 'Presencial',
    frequencia: '100%',
    cargaHoraria: String(data.workload),
    nota: '10,0',
    startDate: formatDateBR(data.startDate),
    endDate: formatDateBR(data.endDate),
    city: 'Toledo',
    fullDate: formatFullDateBR(data.endDate || today),
  };
}

export function getCertificateTemplate(data: CertificateData): string {
  const f = getCertificateFields(data);
  return `Certificamos que, ${f.studentName}\nConcluiu o curso de: ${f.courseTitle}\n${f.modules}\nModalidade ${f.modalidade} – Frequência ${f.frequencia} - Carga horária ${f.cargaHoraria} horas - Nota ${f.nota}\nNo período de ${f.startDate} a ${f.endDate}\n${f.city}, ${f.fullDate}`;
}
