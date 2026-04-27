import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useStudents, useStudentSchedules } from '@/hooks/use-supabase-data';
import { GraduationCap, Printer, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';

const VANDERLEI_COURSES = [
  'Excel Avançado',
  'Solid',
  'AutoCAD',
  'Sketch',
  'Power BI',
  'Design Gráfico',
];

// Manual overrides
const FORCE_INCLUDE_STUDENT_IDS = new Set<string>([
  'a26c7019-0569-44c4-9c4f-b66432a3c31c', // Luana Jaqueline da Silva Ferreira
]);
const FORCE_EXCLUDE_STUDENT_IDS = new Set<string>([
  '7e3233b7-ec76-4ea8-aba8-36247da857f8', // Gabriel Zimmermann Rodrigues
]);

const normalize = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const VANDERLEI_NORM = VANDERLEI_COURSES.map(normalize);

const isVanderleiCourse = (name: string | null | undefined) => {
  if (!name) return false;
  const n = normalize(name);
  return VANDERLEI_NORM.some(v => n === v || n.includes(v));
};

const DAY_ORDER: Record<string, number> = {
  'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6,
};

const DAY_LABEL: Record<string, string> = {
  'segunda': 'Segunda', 'terca': 'Terça', 'quarta': 'Quarta',
  'quinta': 'Quinta', 'sexta': 'Sexta', 'sabado': 'Sábado',
};

export default function Vanderlei() {
  const { data: students } = useStudents(true);
  const { data: schedules } = useStudentSchedules();

  const rows = useMemo(() => {
    if (!students) return [];
    const schedByCourseId: Record<string, any[]> = {};
    (schedules ?? []).forEach((sch: any) => {
      const scId = sch.student_course_id;
      if (!scId) return;
      if (!schedByCourseId[scId]) schedByCourseId[scId] = [];
      schedByCourseId[scId].push(sch);
    });

    const result: { key: string; name: string; course: string; schedule: string }[] = [];

    (students as any[]).forEach(s => {
      if (FORCE_EXCLUDE_STUDENT_IDS.has(s.id)) return;
      const forceInclude = FORCE_INCLUDE_STUDENT_IDS.has(s.id);

      (s.student_courses ?? []).forEach((sc: any) => {
        if (!sc.is_active) return;
        const courseName = sc.courses?.name || sc.custom_course_name || '';
        if (!forceInclude && !isVanderleiCourse(courseName)) return;

        const slots = schedByCourseId[sc.id] || [];
        const scheduleStr = slots.length === 0
          ? '—'
          : slots
              .map((sch: any) => {
                const ts = sch.time_slots;
                if (!ts) return null;
                return {
                  day: ts.day_of_week,
                  order: DAY_ORDER[normalize(ts.day_of_week)] ?? 99,
                  text: `${DAY_LABEL[normalize(ts.day_of_week)] || ts.day_of_week} ${ts.start_time?.slice(0, 5)}-${ts.end_time?.slice(0, 5)}`,
                };
              })
              .filter(Boolean)
              .sort((a: any, b: any) => a.order - b.order)
              .map((x: any) => x.text)
              .join(', ');

        result.push({
          key: `${s.id}-${sc.id}`,
          name: s.full_name || 'Sem nome',
          course: courseName,
          schedule: scheduleStr,
        });
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [students, schedules]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const html = `
      <html><head><title>Alunos do Professor Vanderlei</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p.sub { font-size: 12px; color: #555; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; }
        .total { margin-top: 12px; font-size: 12px; text-align: right; }
      </style></head><body>
      <h1>Alunos do Professor Vanderlei</h1>
      <p class="sub">Cursos: ${VANDERLEI_COURSES.join(', ')}</p>
      <table>
        <thead><tr><th>Nome Completo</th><th>Curso</th><th>Horário</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr><td>${r.name}</td><td>${r.course}</td><td>${r.schedule}</td></tr>`).join('')}
        </tbody>
      </table>
      <p class="total">Total: <strong>${rows.length}</strong> aluno(s)</p>
      <script>window.onload = () => { window.print(); }<\/script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 12;
    let y = 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Alunos do Professor Vanderlei', marginX, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Cursos: ${VANDERLEI_COURSES.join(', ')}`, marginX, y);
    doc.setTextColor(0);
    y += 6;

    // Header
    const colX = [marginX, marginX + 70, marginX + 130];
    const colW = [70, 60, pageW - marginX - (marginX + 130)];
    const rowH = 7;

    const drawHeader = () => {
      doc.setFillColor(243, 244, 246);
      doc.rect(marginX, y, pageW - marginX * 2, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Nome Completo', colX[0] + 2, y + 5);
      doc.text('Curso', colX[1] + 2, y + 5);
      doc.text('Horário', colX[2] + 2, y + 5);
      y += rowH;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    };

    drawHeader();

    rows.forEach(r => {
      const nameLines = doc.splitTextToSize(r.name, colW[0] - 4);
      const courseLines = doc.splitTextToSize(r.course || '—', colW[1] - 4);
      const schedLines = doc.splitTextToSize(r.schedule || '—', colW[2] - 4);
      const lines = Math.max(nameLines.length, courseLines.length, schedLines.length);
      const h = Math.max(rowH, lines * 5 + 2);

      if (y + h > pageH - 18) {
        doc.addPage();
        y = 16;
        drawHeader();
      }

      doc.setDrawColor(220);
      doc.rect(marginX, y, pageW - marginX * 2, h);
      doc.text(nameLines, colX[0] + 2, y + 5);
      doc.text(courseLines, colX[1] + 2, y + 5);
      doc.text(schedLines, colX[2] + 2, y + 5);
      y += h;
    });

    y += 6;
    if (y > pageH - 12) { doc.addPage(); y = 16; }
    doc.setFontSize(9);
    doc.text(`Total: ${rows.length} aluno(s)`, pageW - marginX, y, { align: 'right' });

    doc.save('alunos-professor-vanderlei.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Alunos do Professor Vanderlei</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={rows.length === 0}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button size="sm" onClick={handleExportPDF} disabled={rows.length === 0}>
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Lista automática de alunos matriculados nos cursos: {VANDERLEI_COURSES.join(', ')}.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Nenhum aluno matriculado nesses cursos.
        </p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Completo</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Horário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.course}</TableCell>
                  <TableCell className="text-sm">{r.schedule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-right">
        Total: <span className="font-semibold">{rows.length}</span> aluno(s)
      </p>
    </div>
  );
}
