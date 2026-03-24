import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, Minus, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  studentName: string;
}

type FilterMode = 'current_month' | 'all' | 'custom';

export function StudentFrequencyDialog({ open, onOpenChange, studentId, studentName }: Props) {
  const [filterMode, setFilterMode] = useState<FilterMode>('current_month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [showDetails, setShowDetails] = useState(false);

  const { data: attendanceRecords } = useQuery({
    queryKey: ['student_attendance_all', studentId],
    enabled: !!studentId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('date, status, time_slot_id, time_slots(start_time, end_time, day_of_week)')
        .eq('student_id', studentId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!attendanceRecords) return [];
    const now = new Date();
    return attendanceRecords.filter((r: any) => {
      if (r.status === 'neutral') return false;
      const d = parseISO(r.date);
      if (filterMode === 'current_month') {
        return d >= startOfMonth(now) && d <= endOfMonth(now);
      }
      if (filterMode === 'custom' && customStart && customEnd) {
        return d >= customStart && d <= customEnd;
      }
      return true; // 'all'
    });
  }, [attendanceRecords, filterMode, customStart, customEnd]);

  const detailRecords = useMemo(() => {
    if (!attendanceRecords) return [];
    const now = new Date();
    return attendanceRecords.filter((r: any) => {
      const d = parseISO(r.date);
      if (filterMode === 'current_month') {
        return d >= startOfMonth(now) && d <= endOfMonth(now);
      }
      if (filterMode === 'custom' && customStart && customEnd) {
        return d >= customStart && d <= customEnd;
      }
      return true;
    });
  }, [attendanceRecords, filterMode, customStart, customEnd]);

  const stats = useMemo(() => {
    const present = filtered.filter(r => r.status === 'present').length;
    const absent = filtered.filter(r => r.status === 'absent').length;
    const total = present + absent;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, pct };
  }, [filtered]);

  const getFrequencyColor = (pct: number) => {
    if (pct >= 75) return 'text-green-600';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 75) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const statusIcon = (status: string) => {
    if (status === 'present') return <Check className="h-4 w-4 text-green-600" />;
    if (status === 'absent') return <X className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Frequência - {studentName}</DialogTitle>
        </DialogHeader>

        {/* Filter */}
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

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            <p className="text-xs text-muted-foreground">Presenças</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            <p className="text-xs text-muted-foreground">Faltas</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className={cn("text-2xl font-bold", getFrequencyColor(stats.pct))}>{stats.pct}%</p>
            <p className="text-xs text-muted-foreground">Frequência</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <Progress value={stats.pct} className="h-3" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">{stats.total} aulas válidas</span>
            <Badge variant={stats.pct >= 75 ? 'default' : stats.pct >= 50 ? 'secondary' : 'destructive'}>
              {stats.pct >= 75 ? 'Boa' : stats.pct >= 50 ? 'Média' : 'Baixa'}
            </Badge>
          </div>
        </div>

        {/* Details toggle */}
        <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)} className="mb-2 w-full">
          {showDetails ? 'Ocultar detalhes' : 'Ver detalhes por dia'}
        </Button>

        {showDetails && (
          <div className="space-y-1 max-h-[300px] overflow-auto">
            {detailRecords.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Nenhum registro encontrado.</p>}
            {detailRecords.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {statusIcon(r.status)}
                  <span>{format(parseISO(r.date), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {(r as any).time_slots?.start_time} - {(r as any).time_slots?.end_time}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
