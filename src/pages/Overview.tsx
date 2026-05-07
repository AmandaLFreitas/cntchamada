import { useState, useMemo } from 'react';
import { format, addWeeks, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayTabs } from '@/components/DayTabs';
import { TimeSlotCard } from '@/components/TimeSlotCard';
import { useTimeSlots, useSlotCounts, useSlotStudents, useCompleteStudent } from '@/hooks/use-supabase-data';
import { getTodayDayName, DAYS_OF_WEEK } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSchool } from '@/contexts/SchoolContext';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';


const dayNameFromDate = (date: Date): string => {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const name = days[date.getDay()];
  if (name === 'Domingo' || name === 'Sexta') return 'Segunda';
  return name;
};

export default function Overview() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState(getTodayDayName());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { schoolId } = useSchool();
  const { data: timeSlots } = useTimeSlots();
  const { data: slotCounts } = useSlotCounts();
  const { data: slotStudents } = useSlotStudents(selectedSlotId);
  const completeStudent = useCompleteStudent();

  const allDaySlots = timeSlots?.filter(s => s.day_of_week === selectedDay) ?? [];

  const { data: searchSlotIds } = useQuery({
    queryKey: ['overview_search', schoolId, selectedDay, search.trim().toLowerCase()],
    enabled: !!schoolId && search.trim().length >= 2,
    queryFn: async () => {
      const term = `%${search.trim()}%`;
      const { data: matched } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId!)
        .ilike('full_name', term);
      const ids = (matched ?? []).map((r: any) => r.id);
      if (ids.length === 0) return new Set<string>();
      const { data: scheds } = await supabase
        .from('student_schedules')
        .select('time_slot_id, time_slots(day_of_week)')
        .eq('school_id', schoolId!)
        .in('student_id', ids);
      const set = new Set<string>();
      (scheds ?? []).forEach((r: any) => {
        if (r.time_slots?.day_of_week === selectedDay) set.add(r.time_slot_id);
      });
      return set;
    },
  });

  const daySlots = search.trim().length >= 2 && searchSlotIds
    ? allDaySlots.filter(s => searchSlotIds.has(s.id))
    : allDaySlots;

  const searchTerm = search.trim().toLowerCase();
  const filteredSlotStudents = (slotStudents ?? []).filter((s: any) => {
    if (searchTerm.length < 2) return true;
    return (s.students?.full_name || '').toLowerCase().includes(searchTerm);
  });

  const studentIds = filteredSlotStudents.map((s: any) => s.students?.id).filter(Boolean) ?? [];

  const { data: firstDates } = useQuery({
    queryKey: ['first_dates_batch', studentIds, schoolId],
    enabled: studentIds.length > 0 && !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, date')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .eq('status', 'present')
        .order('date', { ascending: true });
      const map: Record<string, string> = {};
      data?.forEach(r => {
        if (!map[r.student_id]) map[r.student_id] = r.date;
      });
      return map;
    },
  });

  const { data: scheduleCounts } = useQuery({
    queryKey: ['schedule_counts_batch', studentIds, schoolId],
    enabled: studentIds.length > 0 && !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_schedules')
        .select('student_id, time_slots(start_time, end_time)')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds);
      const map: Record<string, number> = {};
      data?.forEach(r => {
        if (!map[r.student_id]) map[r.student_id] = 0;
        if (r.time_slots) {
          const start = (r.time_slots as any).start_time?.split(':').map(Number) ?? [0, 0];
          const end = (r.time_slots as any).end_time?.split(':').map(Number) ?? [0, 0];
          const hours = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
          map[r.student_id] += Math.max(hours, 1);
        }
      });
      return map;
    },
  });

  const calculateEndDate = (studentId: string, workload: number): string => {
    const startDateStr = firstDates?.[studentId];
    if (!startDateStr) return '-';
    const hoursPerWeek = scheduleCounts?.[studentId] ?? 1;
    const weeks = Math.ceil(workload / hoursPerWeek);
    try {
      const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
      const endDate = addWeeks(startDate, weeks);
      return format(endDate, 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    const dayName = dayNameFromDate(date);
    if (DAYS_OF_WEEK.includes(dayName as any)) {
      setSelectedDay(dayName);
    }
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
  };

  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    handleDateSelect(newDate);
  };

  const handleComplete = async (s: any) => {
    const student = s.students;
    const courseName = student.courses?.name || student.custom_course_name || 'N/A';
    const startDate = firstDates?.[student.id] ?? null;
    completeStudent.mutate(
      { studentId: student.id, studentCourseId: s.student_course_id, courseName, startDate },
      { onSuccess: () => { toast.success('Curso finalizado!'); setSelectedSlotId(null); } }
    );
  };

  return (
    <div>
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[180px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DayTabs value={selectedDay} onChange={handleDayChange} />

      <div className="relative my-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mt-4">
        {daySlots.map(slot => (
          <TimeSlotCard key={slot.id} startTime={slot.start_time} endTime={slot.end_time} studentCount={slotCounts?.[slot.id] ?? 0} onClick={() => setSelectedSlotId(slot.id)} />
        ))}
      </div>

      <Dialog open={!!selectedSlotId} onOpenChange={() => setSelectedSlotId(null)}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Alunos do Horário</DialogTitle>
          </DialogHeader>
          {filteredSlotStudents && filteredSlotStudents.length > 0 ? (
            <div className="space-y-2">
              {filteredSlotStudents.map((s: any) => {
                const student = s.students;
                if (!student) return null;
                const courseName = student.courses?.name || student.custom_course_name || 'N/A';
                const workload = student.workload ?? 48;
                const startDate = firstDates?.[student.id] ?? '-';
                const endDate = calculateEndDate(student.id, workload);
                return (
                  <div key={s.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="font-medium truncate">{student.full_name || 'Sem nome'}</p>
                      <Button size="sm" variant="outline" className="sm:ml-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground self-end sm:self-auto" onClick={() => handleComplete(s)}>
                        Finalizar
                      </Button>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground space-y-0.5 break-words">
                      <p>Curso: {courseName}</p>
                      <p>Carga horária: {workload}h • {scheduleCounts?.[student.id]?.toFixed(0) ?? '?'}h/semana</p>
                      <p>Início: {startDate} • Previsão de término: {endDate}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nenhum aluno neste horário.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
