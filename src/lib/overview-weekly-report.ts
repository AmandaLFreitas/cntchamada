import { addDays, format } from 'date-fns';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx-js-style';
import { supabase } from '@/integrations/supabase/client';
import { calculateScheduledCourseEndDate } from '@/lib/calendar-breaks';

export const OVERVIEW_REPORT_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

const DAY_LABELS: Record<string, string> = {
  Segunda: 'SEGUNDA-FEIRA', Terça: 'TERÇA-FEIRA', Quarta: 'QUARTA-FEIRA',
  Quinta: 'QUINTA-FEIRA', Sexta: 'SEXTA-FEIRA', Sábado: 'SÁBADO',
};

const JS_DAY_BY_NAME: Record<string, number> = {
  Segunda: 1, 'Segunda-feira': 1, Terça: 2, 'Terça-feira': 2,
  Quarta: 3, 'Quarta-feira': 3, Quinta: 4, 'Quinta-feira': 4,
  Sexta: 5, 'Sexta-feira': 5, Sábado: 6, Sabado: 6,
};

const STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento', finalizado: 'Finalizado', desistiu: 'Desistiu',
};

export type OverviewReportStudent = {
  scheduleId: string;
  studentId: string;
  studentCourseId: string;
  name: string;
  course: string;
  workload: number;
  weeklyHours: number;
  courseStart: string;
  firstPresence: string;
  expectedEndDate: string;
  status: string;
};

export type OverviewReportSlot = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  students: OverviewReportStudent[];
};

export type OverviewWeeklyReport = {
  schoolName: string;
  schoolSlug: string;
  generatedAt: string;
  slots: OverviewReportSlot[];
};

const slotHours = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  return Math.max((eh + em / 60) - (sh + sm / 60), 0);
};

const formatHours = (hours: number) => Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
const statusLabel = (status: string) => STATUS_LABELS[status] || status || '—';
const shortTime = (value: string) => value.slice(0, 5);

async function fetchAll(queryFactory: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryFactory(from, from + 999);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export async function fetchOverviewWeeklyReport(schoolId: string, schoolName: string, schoolSlug: string): Promise<OverviewWeeklyReport> {
  const [slotsResult, schedules, attendance] = await Promise.all([
    supabase.from('time_slots').select('id, day_of_week, start_time, end_time'),
    fetchAll((from, to) => (supabase as any).from('student_schedules')
      .select('id, student_id, student_course_id, time_slot_id')
      .eq('school_id', schoolId).range(from, to)),
    fetchAll((from, to) => (supabase as any).from('attendance')
      .select('student_id, time_slot_id, date, status')
      .eq('school_id', schoolId).eq('status', 'present')
      .order('date', { ascending: true }).range(from, to)),
  ]);
  if (slotsResult.error) throw slotsResult.error;

  const slots = (slotsResult.data ?? []).filter(slot => OVERVIEW_REPORT_DAYS.includes(slot.day_of_week as typeof OVERVIEW_REPORT_DAYS[number]));
  const slotMap = new Map(slots.map(slot => [slot.id, slot]));
  const courseIds = [...new Set(schedules.map(row => row.student_course_id).filter(Boolean))];
  const courses = courseIds.length ? await fetchAll((from, to) => (supabase as any).from('student_courses')
    .select('id, student_id, custom_course_name, status, workload, enrollment_date, first_class_date, is_active, students(id, full_name), courses(name)')
    .eq('school_id', schoolId).in('id', courseIds).range(from, to)) : [];
  const courseMap = new Map(courses.filter(course => course.is_active && course.students).map(course => [course.id, course]));

  const schedulesByCourse = new Map<string, any[]>();
  schedules.forEach(schedule => {
    if (!courseMap.has(schedule.student_course_id) || !slotMap.has(schedule.time_slot_id)) return;
    const rows = schedulesByCourse.get(schedule.student_course_id) ?? [];
    rows.push(schedule);
    schedulesByCourse.set(schedule.student_course_id, rows);
  });

  const attendanceByStudent = new Map<string, any[]>();
  attendance.forEach(row => {
    const rows = attendanceByStudent.get(row.student_id) ?? [];
    rows.push(row);
    attendanceByStudent.set(row.student_id, rows);
  });

  const courseInfo = new Map<string, Omit<OverviewReportStudent, 'scheduleId'>>();
  courseMap.forEach((course, courseId) => {
    const courseSchedules = schedulesByCourse.get(courseId) ?? [];
    const courseSlotHours = new Map<string, number>();
    const weeklySchedule: { dayOfWeek: number; hours: number }[] = [];
    courseSchedules.forEach(schedule => {
      const slot = slotMap.get(schedule.time_slot_id);
      if (!slot) return;
      const hours = slotHours(slot.start_time, slot.end_time);
      const dayOfWeek = JS_DAY_BY_NAME[slot.day_of_week];
      if (hours <= 0 || dayOfWeek === undefined) return;
      courseSlotHours.set(slot.id, hours);
      weeklySchedule.push({ dayOfWeek, hours });
    });
    const matchingPresence = (attendanceByStudent.get(course.student_id) ?? [])
      .filter(row => courseSlotHours.has(row.time_slot_id));
    const completed = matchingPresence.reduce((sum, row) => sum + (courseSlotHours.get(row.time_slot_id) ?? 0), 0);
    const workload = Number(course.workload) || 48;
    const remaining = Math.max(workload - completed, 0);
    const projected = remaining > 0 && weeklySchedule.length
      ? calculateScheduledCourseEndDate(addDays(new Date(), 1), remaining, weeklySchedule)
      : remaining <= 0 ? new Date() : null;
    courseInfo.set(courseId, {
      studentId: course.student_id,
      studentCourseId: courseId,
      name: course.students.full_name || 'Sem nome',
      course: course.courses?.name || course.custom_course_name || 'N/A',
      workload,
      weeklyHours: weeklySchedule.reduce((sum, item) => sum + item.hours, 0),
      courseStart: course.first_class_date || course.enrollment_date || '—',
      firstPresence: matchingPresence[0]?.date || '—',
      expectedEndDate: projected ? format(projected, 'dd/MM/yyyy') : '—',
      status: statusLabel(course.status || 'em_andamento'),
    });
  });

  const reportSlots = slots.map(slot => ({
    id: slot.id,
    day: slot.day_of_week,
    startTime: shortTime(slot.start_time),
    endTime: shortTime(slot.end_time),
    students: schedules
      .filter(schedule => schedule.time_slot_id === slot.id)
      .flatMap(schedule => {
        const info = courseInfo.get(schedule.student_course_id);
        return info ? [{ scheduleId: schedule.id, ...info }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  })).sort((a, b) => OVERVIEW_REPORT_DAYS.indexOf(a.day as typeof OVERVIEW_REPORT_DAYS[number]) - OVERVIEW_REPORT_DAYS.indexOf(b.day as typeof OVERVIEW_REPORT_DAYS[number]) || a.startTime.localeCompare(b.startTime));

  return { schoolName, schoolSlug, generatedAt: format(new Date(), 'dd/MM/yyyy'), slots: reportSlots };
}

const flatRows = (report: OverviewWeeklyReport) => OVERVIEW_REPORT_DAYS.flatMap(day => {
  const daySlots = report.slots.filter(slot => slot.day === day);
  if (!daySlots.length) return [{ day: DAY_LABELS[day], time: 'Nenhum horário configurado', student: null }];
  return daySlots.flatMap(slot => slot.students.length
    ? slot.students.map(student => ({ day: DAY_LABELS[day], time: `${slot.startTime} – ${slot.endTime}`, student }))
    : [{ day: DAY_LABELS[day], time: `${slot.startTime} – ${slot.endTime}`, student: null }]);
});

export function exportOverviewExcel(report: OverviewWeeklyReport) {
  const title = 'VISÃO GERAL — ALUNOS POR HORÁRIO';
  const headers = ['Dia', 'Horário', 'Aluno', 'Curso', 'Carga Horária', 'Horas/Semana', 'Início do Curso', 'Primeira Presença', 'Previsão de Término', 'Status'];
  const rows = flatRows(report).map(row => row.student ? [row.day, row.time, row.student.name, row.student.course, `${formatHours(row.student.workload)}h`, `${formatHours(row.student.weeklyHours)}h`, row.student.courseStart, row.student.firstPresence, row.student.expectedEndDate, row.student.status] : [row.day, row.time, 'Sem alunos', '', '', '', '', '', '', '']);
  const sheet = XLSX.utils.aoa_to_sheet([[title], [`Unidade: ${report.schoolName}`], [`Data de geração: ${report.generatedAt}`], [], headers, ...rows]);
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }];
  sheet['!cols'] = [18, 16, 28, 28, 15, 15, 17, 18, 20, 18].map(wch => ({ wch }));
  sheet['!rows'] = [{ hpt: 26 }, { hpt: 18 }, { hpt: 18 }, { hpt: 8 }, { hpt: 28 }];
  sheet['!freeze'] = { xSplit: 0, ySplit: 5 };
  sheet['!autofilter'] = { ref: `A5:J${rows.length + 5}` };
  sheet['!margins'] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  sheet['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
  const border = { style: 'thin', color: { rgb: 'D9E2F3' } };
  for (let row = 0; row < rows.length + 5; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (!cell) continue;
      cell.s = { font: { name: 'Arial', sz: row === 0 ? 16 : 10, bold: row === 0 || row === 4 }, alignment: { vertical: 'center', wrapText: true }, border: row >= 4 ? { top: border, bottom: border, left: border, right: border } : undefined };
      if (row === 0) cell.s = { ...cell.s, font: { name: 'Arial', sz: 16, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E4E8C' } }, alignment: { horizontal: 'center', vertical: 'center' } };
      if (row === 4) cell.s = { ...cell.s, font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2F75B5' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Visão Geral');
  XLSX.writeFile(workbook, `visao-geral-${report.schoolSlug || 'unidade'}.xlsx`);
}

export function exportOverviewPDF(report: OverviewWeeklyReport) {
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let y = 12;
  const drawHeader = () => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text('VISÃO GERAL — ALUNOS POR HORÁRIO', margin, y);
    y += 6; pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(`Unidade: ${report.schoolName}  |  Data de geração: ${report.generatedAt}`, margin, y); y += 7;
  };
  const nextPage = () => { pdf.addPage(); y = 12; drawHeader(); };
  drawHeader();
  OVERVIEW_REPORT_DAYS.forEach((day, dayIndex) => {
    if (dayIndex && y > pageHeight - 35) nextPage();
    pdf.setFillColor(30, 78, 140); pdf.setTextColor(255, 255, 255); pdf.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text(DAY_LABELS[day], margin + 2, y + 5.5); y += 11; pdf.setTextColor(25, 35, 50);
    const daySlots = report.slots.filter(slot => slot.day === day);
    if (!daySlots.length) {
      pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.text('Nenhum horário configurado', margin + 2, y); y += 7; return;
    }
    daySlots.forEach(slot => {
      const students = slot.students.length ? slot.students : [null];
      students.forEach((student, index) => {
        const text = student ? [
          student.name,
          `Curso: ${student.course}`,
          `Carga horária: ${formatHours(student.workload)}h  •  ${formatHours(student.weeklyHours)}h/semana`,
          `Início do curso: ${student.courseStart}  •  Primeira presença: ${student.firstPresence}`,
          `Previsão de término: ${student.expectedEndDate}  •  Status: ${student.status}`,
        ] : ['Sem alunos'];
        const lines = text.flatMap(line => pdf.splitTextToSize(line, pageWidth - margin * 2 - 38));
        const height = Math.max(9, lines.length * 3.6 + 4);
        if (y + height > pageHeight - 13) nextPage();
        if (index === 0) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text(`${slot.startTime} – ${slot.endTime}`, margin + 2, y + 5); }
        pdf.setDrawColor(205, 215, 225); pdf.rect(margin, y, pageWidth - margin * 2, height);
        pdf.setFont('helvetica', student ? 'normal' : 'italic'); pdf.setFontSize(8); pdf.text(lines, margin + 36, y + 4.5); y += height;
      });
      y += 2;
    });
  });
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) { pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(90); pdf.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 5, { align: 'right' }); }
  pdf.save(`visao-geral-${report.schoolSlug || 'unidade'}.pdf`);
}

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));

export function printOverviewReport(report: OverviewWeeklyReport) {
  const content = OVERVIEW_REPORT_DAYS.map(day => {
    const slots = report.slots.filter(slot => slot.day === day);
    const slotHtml = slots.length ? slots.map(slot => `<section class="slot"><h3>${slot.startTime} – ${slot.endTime}</h3>${slot.students.length ? slot.students.map(student => `<article><strong>${escapeHtml(student.name)}</strong><div>Curso: ${escapeHtml(student.course)}</div><div>Carga horária: ${formatHours(student.workload)}h • ${formatHours(student.weeklyHours)}h/semana</div><div>Início do curso: ${escapeHtml(student.courseStart)} • Primeira presença: ${escapeHtml(student.firstPresence)}</div><div>Previsão de término: ${student.expectedEndDate} • Status: ${escapeHtml(student.status)}</div></article>`).join('') : '<p class="empty">Sem alunos</p>'}</section>`).join('') : '<p class="empty">Nenhum horário configurado</p>';
    return `<section class="day"><h2>${DAY_LABELS[day]}</h2>${slotHtml}</section>`;
  }).join('');
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('O navegador bloqueou a janela de impressão.');
  popup.opener = null;
  popup.document.write(`<!doctype html><html><head><title>Visão Geral — Alunos por Horário</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;color:#172033;margin:0}header{border-bottom:2px solid #1e4e8c;margin-bottom:12px;padding-bottom:7px}h1{font-size:17pt;margin:0 0 4px}h2{background:#1e4e8c;color:white;font-size:12pt;padding:6px 8px;margin:12px 0 6px}h3{font-size:10pt;margin:0;padding:5px 7px;background:#e8eef7;border:1px solid #cbd5e1}article,.empty{border:1px solid #cbd5e1;border-top:0;padding:6px 8px;line-height:1.45;break-inside:avoid;page-break-inside:avoid}.slot{margin-bottom:7px;break-inside:auto}.day{break-before:auto}.day+.day{page-break-before:auto}footer{position:fixed;bottom:0;right:0;font-size:8pt;color:#64748b}</style></head><body><header><h1>VISÃO GERAL — ALUNOS POR HORÁRIO</h1><div>Unidade: ${escapeHtml(report.schoolName)} · Data de geração: ${report.generatedAt}</div></header>${content}<footer>Visão Geral — Alunos por Horário</footer><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
  popup.document.close();
}