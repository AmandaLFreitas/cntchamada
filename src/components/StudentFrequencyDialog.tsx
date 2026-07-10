import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, Minus, Calendar, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  studentName: string;
  courseName?: string;
}

type FilterMode = 'current_month' | 'all' | 'custom';

const slotHours = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 1;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const h = (eh + em / 60) - (sh + sm / 60);
  return h > 0 ? h : 1;
};

export function StudentFrequencyDialog({ open, onOpenChange, studentId, studentName, courseName }: Props) {
  const [filterMode, setFilterMode] = useState<FilterMode>('current_month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const { schoolId } = useSchool();

  const { data: attendanceRecords } = useQuery({
    queryKey: ['student_attendance_all', studentId, schoolId],
    enabled: !!studentId && open && !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, status, time_slot_id, time_slots(start_time, end_time, day_of_week)')
        .eq('school_id', schoolId!)
        .eq('student_id', studentId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Each attendance row is an individual hora/aula.
  const perSlotRecords = useMemo(() => {
    if (!attendanceRecords) return [] as Array<{
      id: string; date: string; status: 'present' | 'absent' | 'neutral';
      start: string; end: string; hours: number;
    }>;
    return (attendanceRecords as any[]).map(r => {
      const start = (r.time_slots?.start_time || '').slice(0, 5);
      const end = (r.time_slots?.end_time || '').slice(0, 5);
      return {
        id: r.id,
        date: r.date,
        status: r.status as 'present' | 'absent' | 'neutral',
        start,
        end,
        hours: slotHours(r.time_slots?.start_time, r.time_slots?.end_time),
      };
    }).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.start.localeCompare(b.start);
    });
  }, [attendanceRecords]);

  const inRange = useCallback((dateStr: string) => {
    const now = new Date();
    const d = parseISO(dateStr);
    if (filterMode === 'current_month') {
      return d >= startOfMonth(now) && d <= endOfMonth(now);
    }
    if (filterMode === 'custom' && customStart && customEnd) {
      return d >= customStart && d <= customEnd;
    }
    return true;
  }, [filterMode, customStart, customEnd]);

  const filtered = useMemo(() => perSlotRecords.filter(r => inRange(r.date)), [perSlotRecords, inRange]);

  const stats = useMemo(() => {
    let presentHours = 0;
    let absentHours = 0;
    filtered.forEach(r => {
      if (r.status === 'present') presentHours += r.hours;
      else if (r.status === 'absent') absentHours += r.hours;
    });
    const total = presentHours + absentHours;
    const pct = total > 0 ? Math.round((presentHours / total) * 100) : 0;
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      presentHours: round(presentHours),
      absentHours: round(absentHours),
      totalHours: round(total),
      pct,
    };
  }, [filtered]);

  const detailRecords = useMemo(
    () => filtered.filter(r => r.status !== 'neutral'),
    [filtered]
  );

  const getFrequencyColor = (pct: number) => {
    if (pct >= 75) return 'text-green-600';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const statusIcon = (status: string) => {
    if (status === 'present') return <Check className="h-4 w-4 text-green-600" />;
    if (status === 'absent') return <X className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const generatePDF = useCallback(() => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(18);
    doc.text('Relatório de Frequência', pageWidth / 2, y, { align: 'center' });
    y += 12;

    doc.setFontSize(12);
    doc.text(`Aluno: ${studentName}`, 20, y);
    y += 7;
    if (courseName) {
      doc.text(`Curso: ${courseName}`, 20, y);
      y += 7;
    }
    doc.text(`Período: ${filterMode === 'current_month' ? 'Mês atual' : filterMode === 'all' ? 'Todo o período' : 'Personalizado'}`, 20, y);
    y += 7;
    doc.text(`Data do relatório: ${format(new Date(), 'dd/MM/yyyy')}`, 20, y);
    y += 12;

    doc.setFontSize(14);
    doc.text('Resumo', 20, y);
    y += 8;
    doc.setFontSize(11);
    doc.text(`Horas presentes: ${stats.presentHours}h`, 20, y); y += 6;
    doc.text(`Horas faltadas: ${stats.absentHours}h`, 20, y); y += 6;
    doc.text(`Total de horas: ${stats.totalHours}h`, 20, y); y += 6;
    doc.text(`Frequência: ${stats.pct}%`, 20, y); y += 12;

    if (detailRecords.length > 0) {
      doc.setFontSize(14);
      doc.text('Detalhamento por hora/aula', 20, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Data', 20, y);
      doc.text('Horário', 75, y);
      doc.text('Status', 120, y);
      y += 5;
      doc.line(20, y, pageWidth - 20, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      detailRecords.forEach((r) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const dateStr = format(parseISO(r.date), 'dd/MM/yyyy (EEEE)', { locale: ptBR });
        const hStr = r.start && r.end ? `${r.start} às ${r.end}` : '—';
        const statusStr = r.status === 'present' ? 'Presente' : 'Falta';
        doc.text(dateStr, 20, y);
        doc.text(hStr, 75, y);
        doc.text(statusStr, 120, y);
        y += 5;
      });
    }

    doc.save(`frequencia_${studentName.replace(/\s+/g, '_')}.pdf`);
  }, [studentName, courseName, filterMode, stats, detailRecords]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Frequência - {studentName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mês atual</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="custom">Intervalo personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filterMode === 'custom' && (
          <div className="flex gap-2 mb-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {customStart ? format(customStart, 'dd/MM/yyyy') : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={customStart} onSelect={setCustomStart} className={cn("p-3 pointer-events-auto")} /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={customEnd} onSelect={setCustomEnd} className={cn("p-3 pointer-events-auto")} /></PopoverContent>
            </Popover>
          </div>
        )}

        {/* Summary cards - por HORA */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.presentHours}h</p>
            <p className="text-xs text-muted-foreground">Horas presentes</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.absentHours}h</p>
            <p className="text-xs text-muted-foreground">Horas faltadas</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className={cn("text-2xl font-bold", getFrequencyColor(stats.pct))}>{stats.pct}%</p>
            <p className="text-xs text-muted-foreground">Frequência</p>
          </div>
        </div>

        <div className="mb-4">
          <Progress value={stats.pct} className="h-3" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">{stats.totalHours}h válidas</span>
            <Badge variant={stats.pct >= 75 ? 'default' : stats.pct >= 50 ? 'secondary' : 'destructive'}>
              {stats.pct >= 75 ? 'Boa' : stats.pct >= 50 ? 'Média' : 'Baixa'}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)} className="flex-1">
            {showDetails ? 'Ocultar histórico' : 'Ver histórico por hora'}
          </Button>
          <Button variant="outline" size="sm" onClick={generatePDF} className="flex-1">
            <FileText className="h-4 w-4 mr-1" /> Gerar PDF
          </Button>
        </div>

        {showDetails && (
          <div className="space-y-1 max-h-[300px] overflow-auto">
            {detailRecords.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Nenhum registro encontrado.</p>}
        {detailRecords.map((r) => (
          <div key={r.id} className="border rounded px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {statusIcon(r.status)}
                <span className="truncate">
                  {format(parseISO(r.date), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                </span>
              </div>
              {r.start && r.end && (
                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground whitespace-nowrap">
                  {r.start} às {r.end}
                </span>
              )}
            </div>
          </div>
        ))}
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
