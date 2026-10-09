import { describe, expect, it } from 'vitest';
import { selectPlanningPeriod, type PlanningEnrollment } from './completion-planning-data';
import { buildCompletionPlanningWorkbook } from './completion-planning-excel';

const entry = (id: string, studentId: string, date: Date): PlanningEnrollment => ({
  id, studentId, expectedEnd: date, school: 'Toledo', name: 'Aluno', phone: '', birthDate: null,
  course: 'Curso', workload: 48, completed: 40, weeklyHours: 4, days: 'Terça', times: 'Terça: 14:30 – 15:30',
  enrollmentDate: new Date(2025, 0, 1), startDate: null, firstPresence: null, status: 'em_andamento', observations: '',
});
describe('Planejamento de finalizações', () => {
  it('inclui limites, preserva matrículas distintas e remove duplicatas e finalizados', () => {
    const a = entry('a', 's1', new Date(2026, 0, 1));
    const b = entry('b', 's1', new Date(2027, 1, 28));
    expect(selectPlanningPeriod([a, a, b, entry('c', 's2', new Date(2027, 2, 1)), { ...a, id: 'd', status: 'finalizado' }, { ...a, id: 'e', completed: 48 }]).map(row => row.id)).toEqual(['a', 'b']);
  });
  it('distingue alunos e matrículas com fórmulas, filtros e impressão reais', async () => {
    const rows = [entry('a', 's1', new Date(2026, 10, 1)), entry('b', 's1', new Date(2027, 0, 20))];
    const workbook = buildCompletionPlanningWorkbook(rows, 'Toledo', true);
    expect(workbook.worksheets).toHaveLength(5);
    const summary = workbook.getWorksheet('Resumo');
    expect(summary?.getCell('B9').value).toMatchObject({ result: 1 });
    expect(summary?.getCell('C9').value).toMatchObject({ result: 2 });
    const all = workbook.getWorksheet('Todos os Alunos');
    expect(all?.views[0]).toMatchObject({ state: 'frozen', ySplit: 5 });
    expect(all?.pageSetup.printTitlesRow).toBe('1:5');
    expect(all?.getCell('H6').value).toMatchObject({ formula: 'MAX(F6-G6,0)', result: 8 });
    expect((await workbook.xlsx.writeBuffer()).byteLength).toBeGreaterThan(1000);
  });
  it('não exporta data de matrícula para usuários não administradores, inclusive em colunas ocultas', () => {
    const workbook = buildCompletionPlanningWorkbook([entry('a', 's1', new Date(2026, 10, 1))], 'Toledo', false);
    const all = workbook.getWorksheet('Todos os Alunos');
    expect(all?.getCell('M5').value).toBe('Início do curso');
    expect(all?.getCell('M6').value).toBeNull();
    expect(all?.getCell('O6').value).toEqual(new Date(2026, 10, 1));
  });
  it('gera as cinco abas também quando não há matrículas', () => {
    const workbook = buildCompletionPlanningWorkbook([], 'Toledo', true);
    expect(workbook.getWorksheet('Resumo')?.getCell('B9').value).toMatchObject({ formula: "SUM('Todos os Alunos'!T6:T6)" });
    expect(workbook.worksheets).toHaveLength(5);
  });
});