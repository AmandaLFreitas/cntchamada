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
import { toast } from 'sonner';
import { CourseCompletionAlert } from '@/components/CourseCompletionAlert';

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
  const { data: timeSlots } = useTimeSlots();
  const { data: slotCounts } = useSlotCounts();
  const { data: slotStudents } = useSlotStudents(selectedSlotId);
  const completeStudent = useCompleteStudent();

  const daySlots = timeSlots?.filter(s => s.day_of_week === selectedDay) ?? [];

  const studentIds = slotStudents?.map((s: any) => s.students?.id).filter(Boolean) ?? [];

  const { data: firstDates } = useQuery({
    queryKey: ['first_dates_batch', studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, date')
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
    queryKey: ['schedule_counts_batch', studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_schedules')
        .select('student_id, time_slots(start_time, end_time)')
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {daySlots.map(slot => (
          <TimeSlotCard key={slot.id} startTime={slot.start_time} endTime={slot.end_time} studentCount={slotCounts?.[slot.id] ?? 0} onClick={() => setSelectedSlotId(slot.id)} />
        ))}
      </div>

      <Dialog open={!!selectedSlotId} onOpenChange={() => setSelectedSlotId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Alunos do Horário</DialogTitle>
          </DialogHeader>
          {slotStudents && slotStudents.length > 0 ? (
            <div className="space-y-2">
              {slotStudents.map((s: any) => {
                const student = s.students;
                if (!student) return null;
                const courseName = student.courses?.name || student.custom_course_name || 'N/A';
                const workload = student.workload ?? 48;
                const startDate = firstDates?.[student.id] ?? '-';
                const endDate = calculateEndDate(student.id, workload);
                return (
                  <div key={s.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{student.full_name || 'Sem nome'}</p>
                      <Button size="sm" variant="outline" className="ml-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleComplete(s)}>
                        Finalizar
                      </Button>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
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
