import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UserPlus, Printer, Download, FileSpreadsheet } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type Row = {
  student_name: string;
  enrollment_date: string;
  enrollment_date_iso: string;
  course: string;
  school_name: string;
};

function parseBrDate(v: string | null): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const m2 = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  return null;
}

export function EnrollmentsReport() {
  const now = new Date();
  const { school, schoolId } = useSchool();
  const [month, setMonth] = useState<number>(now.getMonth());
  const [year, setYear] = useState<number>(now.getFullYear());
  const printRef = useRef<HTMLDivElement>(null);

  const { data: allEnrollments } = useQuery({
    queryKey: ['enrollments_report', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('student_courses')
        .select('enrollment_date, custom_course_name, students(full_name), courses(name)')
        .eq('school_id', schoolId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows: Row[] = useMemo(() => {
    if (!allEnrollments) return [];
    const filtered: Row[] = [];
    (allEnrollments as any[]).forEach((sc) => {
      const d = parseBrDate(sc.enrollment_date);
      if (!d) return;
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      filtered.push({
        student_name: sc.students?.full_name || 'Sem nome',
        enrollment_date: sc.enrollment_date,
        enrollment_date_iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        course: sc.courses?.name || sc.custom_course_name || 'N/A',
        school_name: school?.name || '',
      });
    });
    return filtered.sort((a, b) => a.enrollment_date_iso.localeCompare(b.enrollment_date_iso));
  }, [allEnrollments, month, year, school]);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = now.getFullYear() + 1; y >= 2020; y--) arr.push(y);
    return arr;
  }, [now]);

  const exportExcel = () => {
    const data = rows.map(r => ({
      Aluno: r.student_name,
      'Data da matrícula': r.enrollment_date,
      Curso: r.course,
      Unidade: r.school_name,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matrículas');
    XLSX.writeFile(wb, `matriculas-${MONTHS[month]}-${year}.xlsx`);
  };

  const exportPDF = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`matriculas-${MONTHS[month]}-${year}.pdf`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Matrículas do Período</h2>
      </div>

      <div className="flex flex-wrap gap-3 items-end print:hidden">
        <div>
          <Label className="text-xs">Mês</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ano</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="h-4 w-4 mr-1" />PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
        </div>
      </div>

      <div ref={printRef} className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">Unidade: <span className="font-medium text-foreground">{school?.name || '—'}</span></p>
            <p className="text-sm text-muted-foreground">Período: <span className="font-medium text-foreground">{MONTHS[month]} / {year}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total de matrículas</p>
            <p className="text-3xl font-bold text-primary">{rows.length}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma matrícula neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Aluno</th>
                  <th className="py-2 pr-2">Data da matrícula</th>
                  <th className="py-2 pr-2">Curso</th>
                  <th className="py-2 pr-2">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-b last:border-b-0">
                    <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 pr-2 font-medium">{r.student_name}</td>
                    <td className="py-2 pr-2">{r.enrollment_date}</td>
                    <td className="py-2 pr-2">{r.course}</td>
                    <td className="py-2 pr-2">{r.school_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
