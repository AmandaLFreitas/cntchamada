import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { PlanningEnrollment } from '@/lib/completion-planning-data';

const palette = { title: '203A43', header: '276E7A', stripe: 'F0F6F7', border: 'D6E2E5', ink: '243746' };
const sheetNames = ['Finalização em 2026', 'Janeiro de 2027', 'Fevereiro de 2027', 'Todos os Alunos'];
const quoted = (name: string) => `'${name}'`;
const uniqueCount = (rows: PlanningEnrollment[]) => new Set(rows.map(row => row.studentId)).size;

function header(sheet: ExcelJS.Worksheet, units: string, date: Date, columns: number) {
  sheet.mergeCells(1, 1, 1, columns);
  sheet.getCell('A1').value = 'PLANEJAMENTO DE FINALIZAÇÃO DE CURSOS';
  sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.title } };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, columns);
  sheet.getCell('A2').value = 'Período de janeiro de 2026 a fevereiro de 2027';
  sheet.mergeCells(3, 1, 3, columns);
  sheet.getCell('A3').value = `Unidades: ${units} • Gerado em ${format(date, 'dd/MM/yyyy HH:mm')}`;
  sheet.mergeCells(4, 1, 4, columns);
  sheet.getCell('A4').value = 'Matrículas em andamento com horas restantes; previsão atual da Visão Geral. Pessoas únicas e matrículas são contadas separadamente.';
  sheet.getRow(4).height = 30;
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:5', margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  sheet.headerFooter.oddFooter = 'Página &P de &N';
  sheet.views = [{ state: 'frozen', ySplit: 5 }];
}

function style(sheet: ExcelJS.Worksheet, headerRows: number[]) {
  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, cell => {
      if (rowNumber !== 1) cell.font = { name: 'Arial', size: 10, color: { argb: palette.ink }, bold: headerRows.includes(rowNumber) };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (rowNumber >= 5) {
        cell.border = { bottom: { style: 'hair', color: { argb: palette.border } } };
        if (rowNumber % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.stripe } };
      }
      if (headerRows.includes(rowNumber)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.header } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });
  });
}

export function buildCompletionPlanningWorkbook(rows: PlanningEnrollment[], units: string, isAdmin: boolean, generatedAt = new Date()) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CNT Informática';
  workbook.created = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const summary = workbook.addWorksheet('Resumo');
  header(summary, units, generatedAt, 5);
  summary.columns = [42, 22, 22, 20, 20].map(width => ({ width }));
  const groups = [rows.filter(row => row.expectedEnd.getFullYear() === 2026), rows.filter(row => row.expectedEnd.getFullYear() === 2027 && row.expectedEnd.getMonth() === 0), rows.filter(row => row.expectedEnd.getFullYear() === 2027 && row.expectedEnd.getMonth() === 1), rows];
  if (groups.slice(0, 3).reduce((sum, group) => sum + group.length, 0) !== rows.length) throw new Error('Os totais dos períodos não conferem.');
  groups.forEach((group, index) => {
    const sheet = workbook.addWorksheet(sheetNames[index]);
    header(sheet, units, generatedAt, 18);
    const headers = ['Unidade', 'Nome completo', 'Telefone', 'Data de nascimento', 'Curso', 'Carga total (h)', 'Horas de presença (h)', 'Horas restantes (h)', 'Conclusão (%)', 'Horas por semana', 'Dias de aula', 'Horários das aulas', isAdmin ? 'Data de matrícula' : 'Início do curso', isAdmin ? 'Início do curso' : 'Primeira presença', isAdmin ? 'Primeira presença' : 'Previsão de término', isAdmin ? 'Previsão de término' : 'Status da matrícula', isAdmin ? 'Status da matrícula' : 'Observações', isAdmin ? 'Observações' : ''];
    sheet.getRow(5).values = [...headers, 'ID do aluno', 'Pessoa única', 'Pessoa única por curso'];
    sheet.getRow(5).height = 32;
    sheet.columns = [22, 34, 20, 18, 32, 16, 18, 18, 16, 18, 24, 38, 20, 20, 20, 20, 24, 48, 38, 16, 16].map(width => ({ width }));
    for (let i = 19; i <= 21; i++) sheet.getColumn(i).hidden = true;
    if (!isAdmin) sheet.getColumn(18).hidden = true;
    group.forEach((entry, i) => {
      const r = i + 6;
      const remaining = Math.max(entry.workload - entry.completed, 0);
      const tail = isAdmin ? [entry.enrollmentDate, entry.startDate, entry.firstPresence, entry.expectedEnd, 'Em andamento', entry.observations] : [entry.startDate, entry.firstPresence, entry.expectedEnd, 'Em andamento', entry.observations, ''];
      const row = sheet.addRow([entry.school, entry.name, entry.phone, entry.birthDate, entry.course, entry.workload, entry.completed,
        { formula: `MAX(F${r}-G${r},0)`, result: remaining },
        { formula: `IF(F${r}>0,G${r}/F${r},0)`, result: entry.workload > 0 ? entry.completed / entry.workload : 0 },
        entry.weeklyHours, entry.days, entry.times, ...tail, entry.studentId,
        { formula: `IF(COUNTIF($S$6:S${r},S${r})=1,1,0)`, result: group.slice(0, i).some(item => item.studentId === entry.studentId) ? 0 : 1 },
        { formula: `IF(COUNTIFS($S$6:S${r},S${r},$E$6:E${r},E${r})=1,1,0)`, result: group.slice(0, i).some(item => item.studentId === entry.studentId && item.course === entry.course) ? 0 : 1 }]);
      row.height = Math.max(32, entry.times.split('\n').length * 14, Math.min(140, entry.observations.split('\n').length * 14));
      [4, 13, 14, 15, ...(isAdmin ? [16] : [])].forEach(c => { row.getCell(c).numFmt = 'dd/mm/yyyy'; });
      [6, 7, 8, 10].forEach(c => { row.getCell(c).numFmt = '0.##'; });
      row.getCell(9).numFmt = '0.0%';
      row.getCell(3).numFmt = '@';
    });
    sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, sheet.rowCount), column: isAdmin ? 18 : 17 } };
    sheet.pageSetup.printArea = `A1:${isAdmin ? 'R' : 'Q'}${Math.max(sheet.rowCount, 5)}`;
    style(sheet, [5]);
  });
  summary.getRow(5).values = ['Período', 'Alunos únicos', 'Matrículas'];
  groups.forEach((group, i) => {
    const end = Math.max(group.length + 5, 6);
    const sheet = quoted(sheetNames[i]);
    summary.addRow([i === 3 ? 'TOTAL GERAL' : sheetNames[i],
      { formula: `SUM(${sheet}!T6:T${end})`, result: uniqueCount(group) },
      { formula: `COUNTA(${sheet}!S6:S${end})`, result: group.length }]);
  });
  summary.addRow(['Os alunos com vários cursos ou períodos podem aparecer em mais de uma categoria.']);
  summary.mergeCells('A10:E10'); summary.getRow(10).height = 32;
  const headers = [5];
  const totalEnd = Math.max(rows.length + 5, 6);
  const all = quoted('Todos os Alunos');
  const addGroup = (label: string, values: string[], field: 'A' | 'E', flag: 'T' | 'U') => {
    summary.addRow([]);
    const heading = summary.addRow([label, 'Alunos únicos', 'Matrículas']); headers.push(heading.number);
    const start = heading.number;
    values.forEach(value => {
      const matching = rows.filter(row => (field === 'A' ? row.school : row.course) === value);
      const r = summary.rowCount + 1;
      summary.addRow([value,
        { formula: `SUMIF(${all}!${field}6:${field}${totalEnd},A${r},${all}!${flag}6:${flag}${totalEnd})`, result: uniqueCount(matching) },
        { formula: `COUNTIF(${all}!${field}6:${field}${totalEnd},A${r})`, result: matching.length }]);
    });
    // Each summary block has its own filterable Excel table.
    if (values.length) summary.addTable({ name: `Resumo${field}`, ref: `A${start}`, headerRow: true, columns: [{ name: label }, { name: 'Alunos únicos' }, { name: 'Matrículas' }], rows: values.map((_, i) => [summary.getCell(start + 1 + i, 1).value, summary.getCell(start + 1 + i, 2).value, summary.getCell(start + 1 + i, 3).value]), style: { theme: 'TableStyleMedium2', showRowStripes: true } });
  };
  addGroup('Unidade', [...new Set(rows.map(row => row.school))].sort(), 'A', 'T');
  addGroup('Curso', [...new Set(rows.map(row => row.course))].sort(), 'E', 'U');
  summary.autoFilter = 'A5:C9';
  summary.pageSetup.printArea = `A1:E${summary.rowCount}`;
  style(summary, headers);
  summary.getRow(9).font = { name: 'Arial', size: 12, bold: true };
  return workbook;
}

export async function downloadCompletionPlanning(rows: PlanningEnrollment[], units: string, isAdmin: boolean) {
  const workbook = buildCompletionPlanningWorkbook(rows, units, isAdmin);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `planejamento-finalizacoes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}