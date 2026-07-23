import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarClock, Printer, Download, FileSpreadsheet } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom';

type Row = {
  id: string;
  student_name: string;
  phone: string;
  course: string;
  created_at_br: string;
  created_at_iso: string;
  lesson_date_br: string;
  time_slot: string;
  school_name: string;
  status: string;
  observations: string;
  created_by_name: string;
};

function toBrDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function toBrDateFromDate(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export function TrialLessonsScheduledReport() {
  const now = new Date();
  const { school, schoolId } = useSchool();
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('day');
  const [refDate, setRefDate] = useState<string>(now.toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState<string>(now.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(now.toISOString().slice(0, 10));
  const printRef = useRef<HTMLDivElement>(null);

  const { data: allLessons } = useQuery({
    queryKey: ['trial_lessons_scheduled_report', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trial_lessons')
        .select('id, student_name, course, time_slot, lesson_date, status, observations, created_at, created_by_name, school_id')
        .eq('school_id', schoolId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const range = useMemo(() => {
    const ref = new Date(refDate + 'T00:00:00');
    let s: Date, e: Date;
    if (period === 'day') { s = startOfDay(ref); e = endOfDay(ref); }
    else if (period === 'week') {
      const dow = ref.getDay(); s = startOfDay(new Date(ref)); s.setDate(s.getDate() - dow);
      e = endOfDay(new Date(s)); e.setDate(e.getDate() + 6);
    }
    else if (period === 'month') { s = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1)); e = endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)); }
    else if (period === 'year') { s = startOfDay(new Date(ref.getFullYear(), 0, 1)); e = endOfDay(new Date(ref.getFullYear(), 11, 31)); }
    else { s = startOfDay(new Date(startDate + 'T00:00:00')); e = endOfDay(new Date(endDate + 'T00:00:00')); }
    return { s, e };
  }, [period, refDate, startDate, endDate]);

  const baseRows: Omit<Row, 'phone'>[] = useMemo(() => {
    if (!allLessons) return [];
    return (allLessons as any[])
      .filter(l => {
        const c = new Date(l.created_at);
        return c >= range.s && c <= range.e;
      })
      .map(l => ({
        id: l.id,
        student_name: l.student_name || 'Sem nome',
        course: l.course || '—',
        created_at_br: toBrDate(l.created_at),
        created_at_iso: l.created_at,
        lesson_date_br: toBrDateFromDate(l.lesson_date),
        time_slot: l.time_slot || '—',
        school_name: school?.name || '',
        status: l.status || 'OK',
        observations: l.observations || '',
        created_by_name: l.created_by_name || '—',
      }));
  }, [allLessons, range, school]);

  const { data: phonesMap } = useQuery({
    queryKey: ['trial_lessons_phones', baseRows.map(r => r.id).join(','), isAdmin],
    enabled: isAdmin && baseRows.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(baseRows.map(async r => {
        const { data } = await (supabase as any).rpc('get_trial_lesson_phone', { _id: r.id });
        return [r.id, (data as string) || ''] as const;
      }));
      return Object.fromEntries(entries) as Record<string, string>;
    },
  });

  const rows: Row[] = useMemo(() =>
    baseRows.map(r => ({ ...r, phone: phonesMap?.[r.id] || (isAdmin ? '' : '—') })),
    [baseRows, phonesMap, isAdmin]
  );

  const periodLabel = useMemo(() => {
    const fmt = (d: Date) => toBrDate(d.toISOString());
    if (period === 'day') return fmt(range.s);
    if (period === 'week') return `${fmt(range.s)} a ${fmt(range.e)}`;
    if (period === 'month') return `${String(range.s.getMonth() + 1).padStart(2, '0')}/${range.s.getFullYear()}`;
    if (period === 'year') return String(range.s.getFullYear());
    return `${fmt(range.s)} a ${fmt(range.e)}`;
  }, [period, range]);

  const fileTag = periodLabel.replace(/[\/\s]/g, '-');

  const exportExcel = () => {
    const data = rows.map(r => ({
      Aluno: r.student_name,
      Telefone: r.phone,
      Curso: r.course,
      'Data do Agendamento': r.created_at_br,
      'Data da Aula': r.lesson_date_br,
      Horário: r.time_slot,
      Unidade: r.school_name,
      'Agendado por': r.created_by_name,
      Situação: r.status,
      Observação: r.observations,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
    XLSX.writeFile(wb, `agendamentos-aulas-experimentais-${fileTag}.xlsx`);
  };

  const exportPDF = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`agendamentos-aulas-experimentais-${fileTag}.pdf`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Agendamentos de Aulas Experimentais</h2>
      </div>

      <div className="flex flex-wrap gap-3 items-end print:hidden">
        <div>
          <Label className="text-xs">Período</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Dia</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period !== 'custom' ? (
          <div>
            <Label className="text-xs">Data de referência</Label>
            <Input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className="w-[170px]" />
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[170px]" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[170px]" />
            </div>
          </>
        )}

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
            <p className="text-sm text-muted-foreground">Agendamentos em: <span className="font-medium text-foreground">{periodLabel}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total agendado</p>
            <p className="text-3xl font-bold text-primary">{rows.length}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum agendamento neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Aluno</th>
                  <th className="py-2 pr-2">Telefone</th>
                  <th className="py-2 pr-2">Curso</th>
                  <th className="py-2 pr-2">Agendado em</th>
                  <th className="py-2 pr-2">Data da aula</th>
                  <th className="py-2 pr-2">Horário</th>
                  <th className="py-2 pr-2">Unidade</th>
                  <th className="py-2 pr-2">Situação</th>
                  <th className="py-2 pr-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 pr-2 font-medium">{r.student_name}</td>
                    <td className="py-2 pr-2">{r.phone || '—'}</td>
                    <td className="py-2 pr-2">{r.course}</td>
                    <td className="py-2 pr-2">{r.created_at_br}</td>
                    <td className="py-2 pr-2">{r.lesson_date_br}</td>
                    <td className="py-2 pr-2">{r.time_slot}</td>
                    <td className="py-2 pr-2">{r.school_name}</td>
                    <td className="py-2 pr-2">{r.status}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{r.observations || '—'}</td>
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
