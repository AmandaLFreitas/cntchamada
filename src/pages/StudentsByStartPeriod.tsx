import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Download, FileSpreadsheet, Printer, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StudentDetailsDialog } from '@/components/StudentDetailsDialog';
import { formatPhoneMask } from '@/lib/utils';

type TimeSlot = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
};

type PeriodRow = {
  studentCourseId: string;
  studentId: string;
  studentName: string;
  phone: string;
  courseName: string;
  firstClassDate: string;
  workload: number;
  weeklyHours: number;
  schedules: TimeSlot[];
  status: string;
  schoolName: string;
};

const STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  desistiu: 'Desistiu',
};

const DAY_ORDER: Record<string, number> = {
  Segunda: 1,
  'Segunda-feira': 1,
  Terça: 2,
  'Terça-feira': 2,
  Quarta: 3,
  'Quarta-feira': 3,
  Quinta: 4,
  'Quinta-feira': 4,
  Sexta: 5,
  'Sexta-feira': 5,
  Sábado: 6,
  Sabado: 6,
  Domingo: 7,
};

function parseCourseDate(value?: string | null): Date | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const parts = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : br
      ? [Number(br[3]), Number(br[2]), Number(br[1])]
      : null;
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatDate(value: string): string {
  const date = parseCourseDate(value);
  if (!date) return value || '—';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function calculateWeeklyHours(slots: TimeSlot[]): number {
  const unique = new Map<string, TimeSlot>();
  slots.forEach(slot => unique.set(`${slot.day_of_week}|${slot.start_time}|${slot.end_time}`, slot));
  const minutes = Array.from(unique.values()).reduce((total, slot) => {
    return total + Math.max(0, timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time));
  }, 0);
  return minutes / 60;
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1).replace('.', ',')}h`;
}

function formatSchedules(slots: TimeSlot[]): string {
  if (slots.length === 0) return '—';
  return [...slots]
    .sort((a, b) => (DAY_ORDER[a.day_of_week] ?? 99) - (DAY_ORDER[b.day_of_week] ?? 99) || a.start_time.localeCompare(b.start_time))
    .map(slot => `${slot.day_of_week} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`)
    .join(', ');
}

async function fetchAllRows(queryFactory: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function PeriodTable({ rows, onStudentClick }: { rows: PeriodRow[]; onStudentClick: (id: string) => void }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum curso encontrado para este período.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aluno</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Data de início</TableHead>
          <TableHead>Carga total</TableHead>
          <TableHead>Carga semanal</TableHead>
          <TableHead className="min-w-[230px]">Dias e horários</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Unidade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.studentCourseId}>
            <TableCell className="font-medium">
              <Button variant="link" className="h-auto p-0 text-left font-medium print:text-foreground" onClick={() => onStudentClick(row.studentId)}>
                {row.studentName}
              </Button>
            </TableCell>
            <TableCell>{formatPhoneMask(row.phone) || '—'}</TableCell>
            <TableCell>{row.courseName}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDate(row.firstClassDate)}</TableCell>
            <TableCell>{formatHours(row.workload)}</TableCell>
            <TableCell>{formatHours(row.weeklyHours)}</TableCell>
            <TableCell className="text-xs">{formatSchedules(row.schedules)}</TableCell>
            <TableCell>{STATUS_LABELS[row.status] || row.status || '—'}</TableCell>
            <TableCell>{row.schoolName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function StudentsByStartPeriod() {
  const currentYear = new Date().getFullYear();
  const { schoolId, school } = useSchool();
  const [year, setYear] = useState(String(currentYear));
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['students_by_start_period', schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      if (!schoolId) return { courses: [], schedules: [] };
      const courses = await fetchAllRows((from, to) => (supabase as any)
        .from('student_courses')
        .select('id, student_id, first_class_date, workload, status, custom_course_name, students(id, full_name, phone), courses(name)')
        .eq('school_id', schoolId)
        .order('first_class_date', { ascending: true })
        .range(from, to));
      const schedules = await fetchAllRows((from, to) => (supabase as any)
        .from('student_schedules')
        .select('student_course_id, time_slots(id, day_of_week, start_time, end_time)')
        .eq('school_id', schoolId)
        .range(from, to));
      return { courses, schedules };
    },
  });

  const allRows = useMemo<PeriodRow[]>(() => {
    const byCourse = new Map<string, TimeSlot[]>();
    (data?.schedules ?? []).forEach((schedule: any) => {
      if (!schedule.student_course_id || !schedule.time_slots) return;
      const slots = byCourse.get(schedule.student_course_id) ?? [];
      slots.push(schedule.time_slots as TimeSlot);
      byCourse.set(schedule.student_course_id, slots);
    });

    return (data?.courses ?? []).flatMap((course: any) => {
      const date = parseCourseDate(course.first_class_date);
      if (!date || !course.students) return [];
      const schedules = byCourse.get(course.id) ?? [];
      return [{
        studentCourseId: course.id,
        studentId: course.student_id,
        studentName: course.students.full_name || 'Sem nome',
        phone: course.students.phone || '',
        courseName: course.courses?.name || course.custom_course_name || 'Sem curso',
        firstClassDate: course.first_class_date,
        workload: Number(course.workload) || 0,
        weeklyHours: calculateWeeklyHours(schedules),
        schedules,
        status: course.status || 'em_andamento',
        schoolName: school?.name || '',
      }];
    });
  }, [data, school]);

  const years = useMemo(() => {
    const values = new Set<number>([currentYear]);
    allRows.forEach(row => {
      const date = parseCourseDate(row.firstClassDate);
      if (date) values.add(date.getFullYear());
    });
    return Array.from(values).sort((a, b) => b - a);
  }, [allRows, currentYear]);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return allRows.filter(row => {
      const date = parseCourseDate(row.firstClassDate);
      if (!date || date.getFullYear() !== Number(year)) return false;
      if (!normalized) return true;
      return `${row.studentName} ${row.phone} ${row.courseName}`.toLocaleLowerCase('pt-BR').includes(normalized);
    }).sort((a, b) => {
      const aTime = parseCourseDate(a.firstClassDate)?.getTime() ?? 0;
      const bTime = parseCourseDate(b.firstClassDate)?.getTime() ?? 0;
      return aTime - bTime || a.studentName.localeCompare(b.studentName, 'pt-BR');
    });
  }, [allRows, search, year]);

  const januaryToJune = filteredRows.filter(row => {
    const month = parseCourseDate(row.firstClassDate)?.getMonth();
    return month !== undefined && month >= 0 && month <= 5;
  });
  const juneToSeptember = filteredRows.filter(row => {
    const month = parseCourseDate(row.firstClassDate)?.getMonth();
    return month !== undefined && month >= 5 && month <= 8 && row.weeklyHours >= 4;
  });

  const exportRows = (rows: PeriodRow[]) => rows.map(row => ({
    Aluno: row.studentName,
    Telefone: formatPhoneMask(row.phone) || '—',
    Curso: row.courseName,
    'Data de início': formatDate(row.firstClassDate),
    'Carga total': formatHours(row.workload),
    'Carga semanal': formatHours(row.weeklyHours),
    'Dias e horários': formatSchedules(row.schedules),
    Status: STATUS_LABELS[row.status] || row.status || '—',
    Unidade: row.schoolName,
  }));

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows(januaryToJune)), 'Janeiro a Junho');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows(juneToSeptember)), 'Junho a Setembro 4h');
    XLSX.writeFile(workbook, `alunos-por-periodo-${school?.slug || 'unidade'}-${year}.xlsx`);
  };

  const exportPDF = () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const columns = [
      { label: 'Aluno', width: 43 },
      { label: 'Telefone', width: 25 },
      { label: 'Curso', width: 39 },
      { label: 'Início', width: 22 },
      { label: 'Total', width: 16 },
      { label: 'Semanal', width: 19 },
      { label: 'Dias e horários', width: 68 },
      { label: 'Status', width: 27 },
      { label: 'Unidade', width: 18 },
    ];
    let y = margin;

    const drawDocumentHeader = () => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('Alunos por Período de Início', margin, y);
      y += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`Unidade: ${school?.name || '—'}  |  Ano: ${year}`, margin, y);
      y += 8;
    };

    const drawTableHeader = () => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      let x = margin;
      columns.forEach(column => {
        pdf.rect(x, y, column.width, 7);
        pdf.text(column.label, x + 1.5, y + 4.5);
        x += column.width;
      });
      y += 7;
    };

    const addPage = () => {
      pdf.addPage();
      y = margin;
      drawDocumentHeader();
      drawTableHeader();
    };

    const drawSection = (title: string, rows: PeriodRow[], startOnNewPage: boolean) => {
      if (startOnNewPage) {
        pdf.addPage();
        y = margin;
        drawDocumentHeader();
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(`${title} (${rows.length} ${rows.length === 1 ? 'curso' : 'cursos'})`, margin, y);
      y += 6;
      drawTableHeader();

      if (rows.length === 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text('Nenhum curso encontrado para este período.', margin + 1.5, y + 5);
        y += 9;
        return;
      }

      rows.forEach(row => {
        const values = [
          row.studentName,
          formatPhoneMask(row.phone) || '—',
          row.courseName,
          formatDate(row.firstClassDate),
          formatHours(row.workload),
          formatHours(row.weeklyHours),
          formatSchedules(row.schedules),
          STATUS_LABELS[row.status] || row.status || '—',
          row.schoolName,
        ];
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        const lines = values.map((value, index) => pdf.splitTextToSize(value, columns[index].width - 3));
        const rowHeight = Math.max(7, Math.max(...lines.map(value => value.length)) * 3.2 + 2);
        if (y + rowHeight > pageHeight - margin) addPage();
        let x = margin;
        lines.forEach((value, index) => {
          pdf.rect(x, y, columns[index].width, rowHeight);
          pdf.text(value, x + 1.5, y + 3.8);
          x += columns[index].width;
        });
        y += rowHeight;
      });
    };

    drawDocumentHeader();
    drawSection('Início entre janeiro e junho', januaryToJune, false);
    drawSection('Início entre junho e setembro — 4h ou mais por semana', juneToSeptember, true);
    pdf.save(`alunos-por-periodo-${school?.slug || 'unidade'}-${year}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 print:hidden">
        <CalendarRange className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Alunos por Período de Início</h1>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="period-year">Ano</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="period-year" className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(item => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="relative min-w-[240px] flex-1 space-y-1 sm:max-w-sm">
          <Label htmlFor="period-search">Buscar</Label>
          <Search className="absolute bottom-3 left-3 h-4 w-4 text-muted-foreground" />
          <Input id="period-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, telefone ou curso" className="pl-9" />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><Download className="mr-1 h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
        </div>
      </div>

      {isLoading && <p className="py-10 text-center text-muted-foreground">Carregando...</p>}
      {error && <p className="py-10 text-center text-destructive">Não foi possível carregar os dados.</p>}

      {!isLoading && !error && (
        <div data-report-print className="space-y-8 bg-card p-4 sm:p-5">
          <header className="border-b pb-3">
            <h2 className="text-xl font-bold">Alunos por Período de Início</h2>
            <p className="text-sm text-muted-foreground">Unidade: {school?.name || '—'} · Ano: {year}</p>
          </header>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold">Início entre janeiro e junho</h3>
              <span className="text-sm text-muted-foreground">{januaryToJune.length} {januaryToJune.length === 1 ? 'curso' : 'cursos'}</span>
            </div>
            <div className="border">
              <PeriodTable rows={januaryToJune} onStudentClick={setSelectedStudentId} />
            </div>
          </section>

          <section className="space-y-3 break-before-page">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold">Início entre junho e setembro · 4h ou mais por semana</h3>
              <span className="text-sm text-muted-foreground">{juneToSeptember.length} {juneToSeptember.length === 1 ? 'curso' : 'cursos'}</span>
            </div>
            <div className="border">
              <PeriodTable rows={juneToSeptember} onStudentClick={setSelectedStudentId} />
            </div>
          </section>
        </div>
      )}

      <StudentDetailsDialog open={Boolean(selectedStudentId)} onOpenChange={open => !open && setSelectedStudentId(null)} studentId={selectedStudentId} />
    </div>
  );
}