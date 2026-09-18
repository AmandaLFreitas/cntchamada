import { useState, useMemo } from 'react';
import { addDays, format } from 'date-fns';
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
import { Badge } from '@/components/ui/badge';
import { useNewStudents } from '@/hooks/use-new-students';
import { calculateScheduledCourseEndDate } from '@/lib/calendar-breaks';

const STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  desistiu: 'Desistiu',
};


const dayNameFromDate = (date: Date): string => {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const name = days[date.getDay()];
  if (name === 'Domingo' || name === 'Sexta') return 'Segunda';
  return name;
};

const JS_DAY_BY_NAME: Record<string, number> = {
  Domingo: 0,
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
};

const slotDurationHours = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  return Math.max((endHour + endMinute / 60) - (startHour + startMinute / 60), 0);
};

type CourseForecast = {
  weeklyHours: number;
  hoursCompleted: number;
  expectedEndDate: string;
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
  const { data: newStudents } = useNewStudents();
  const newStudentIds = new Set((newStudents ?? []).map(n => n.studentId));

  const allDaySlots = timeSlots?.filter(s => s.day_of_week === selectedDay) ?? [];

  const { data: searchSlotIds } = useQuery({
    queryKey: ['overview_search_all', schoolId, search.trim().toLowerCase()],
    enabled: !!schoolId && search.trim().length >= 2,
    queryFn: async () => {
      const raw = search.trim().toLowerCase();
      const term = `%${raw}%`;
      const digitTerm = raw.replace(/\D/g, '');
      const queries = [
        supabase.from('students').select('id').eq('school_id', schoolId!).ilike('full_name', term),
        supabase.from('students').select('id').eq('school_id', schoolId!).ilike('phone', term),
      ];
      if (digitTerm) {
        queries.push(supabase.from('students').select('id').eq('school_id', schoolId!).ilike('phone', `%${digitTerm}%`));
      }
      const results = await Promise.all(queries);
      const ids = results.flatMap(r => (r.data ?? []).map((x: any) => x.id));
      if (ids.length === 0) return new Set<string>();
      const { data: scheds } = await supabase
        .from('student_schedules')
        .select('time_slot_id')
        .eq('school_id', schoolId!)
        .in('student_id', ids);
      const set = new Set<string>();
      (scheds ?? []).forEach((r: any) => set.add(r.time_slot_id));
      return set;
    },
  });

  const isSearching = search.trim().length >= 2;
  const daySlots = isSearching && searchSlotIds
    ? (timeSlots ?? []).filter(s => searchSlotIds.has(s.id))
    : allDaySlots;

  const searchTerm = search.trim().toLowerCase();
  const filteredSlotStudents = (slotStudents ?? []).filter((s: any) => {
    if (searchTerm.length < 2) return true;
    const nameMatch = (s.students?.full_name || '').toLowerCase().includes(searchTerm);
    const phoneMatch = (s.students?.phone || '').toLowerCase().includes(searchTerm) || (s.students?.phone || '').replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''));
    return nameMatch || phoneMatch;
  });

  const studentIds = filteredSlotStudents.map((s: any) => s.students?.id).filter(Boolean) ?? [];
  const studentCourseIds = [...new Set(filteredSlotStudents.map((s: any) => s.student_course_id).filter(Boolean))] as string[];

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

  const { data: courseForecasts } = useQuery({
    queryKey: ['overview_course_forecasts', schoolId, studentIds, studentCourseIds],
    enabled: studentIds.length > 0 && studentCourseIds.length > 0 && !!schoolId,
    queryFn: async () => {
      const [schedulesResult, attendanceResult] = await Promise.all([
        supabase
          .from('student_schedules')
          .select('student_course_id, time_slot_id, time_slots(day_of_week, start_time, end_time)')
          .eq('school_id', schoolId!)
          .in('student_course_id', studentCourseIds),
        supabase
          .from('attendance')
          .select('student_id, time_slot_id, status')
          .eq('school_id', schoolId!)
          .in('student_id', studentIds)
          .eq('status', 'present'),
      ]);
      if (schedulesResult.error) throw schedulesResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      const schedulesByCourse: Record<string, {
        slotHours: Map<string, number>;
        weeklySchedule: { dayOfWeek: number; hours: number }[];
      }> = {};
      (schedulesResult.data ?? []).forEach((row: any) => {
        const courseId = row.student_course_id;
        const slot = row.time_slots;
        const dayOfWeek = JS_DAY_BY_NAME[slot?.day_of_week];
        const hours = slotDurationHours(slot?.start_time, slot?.end_time);
        if (!courseId || !row.time_slot_id || dayOfWeek === undefined || hours <= 0) return;
        if (!schedulesByCourse[courseId]) {
          schedulesByCourse[courseId] = { slotHours: new Map(), weeklySchedule: [] };
        }
        schedulesByCourse[courseId].slotHours.set(row.time_slot_id, hours);
        schedulesByCourse[courseId].weeklySchedule.push({ dayOfWeek, hours });
      });

      const attendanceByStudent: Record<string, { time_slot_id: string }[]> = {};
      (attendanceResult.data ?? []).forEach((row: any) => {
        if (!attendanceByStudent[row.student_id]) attendanceByStudent[row.student_id] = [];
        attendanceByStudent[row.student_id].push({ time_slot_id: row.time_slot_id });
      });

      const forecasts: Record<string, CourseForecast> = {};
      filteredSlotStudents.forEach((schedule: any) => {
        const courseId = schedule.student_course_id;
        const student = schedule.students;
        if (!courseId || !student || forecasts[courseId]) return;
        const courseSchedule = schedulesByCourse[courseId];
        if (!courseSchedule) return;

        const hoursCompleted = (attendanceByStudent[student.id] ?? []).reduce((total, attendance) => {
          return total + (courseSchedule.slotHours.get(attendance.time_slot_id) ?? 0);
        }, 0);
        const workload = Number(student.workload) || 48;
        const hoursRemaining = Math.max(workload - hoursCompleted, 0);
        const weeklyHours = courseSchedule.weeklySchedule.reduce((total, item) => total + item.hours, 0);
        const projectedDate = hoursRemaining > 0
          ? calculateScheduledCourseEndDate(addDays(new Date(), 1), hoursRemaining, courseSchedule.weeklySchedule)
          : new Date();

        forecasts[courseId] = {
          weeklyHours,
          hoursCompleted,
          expectedEndDate: projectedDate ? format(projectedDate, 'dd/MM/yyyy') : '-',
        };
      });
      return forecasts;
    },
  });

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
          <TimeSlotCard key={slot.id} startTime={slot.start_time} endTime={slot.end_time} studentCount={slotCounts?.[slot.id] ?? 0} onClick={() => setSelectedSlotId(slot.id)} dayLabel={isSearching ? slot.day_of_week : undefined} />
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
                const firstPresence = firstDates?.[student.id] ?? null;
                const courseStart = student.first_class_date || student.enrollment_date || null;
                const forecast = courseForecasts?.[s.student_course_id];
                const endDate = forecast?.expectedEndDate ?? '-';
                const courseStatus = student.course_status || 'em_andamento';
                const isNew = newStudentIds.has(student.id);
                return (
                  <div key={s.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {isNew && (
                          <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0" title={`Curso: ${courseName}\nInício: ${courseStart || '—'}`}>
                            Novo
                          </Badge>
                        )}
                        <p className="font-medium truncate">{student.full_name || 'Sem nome'}</p>
                      </div>
                      <Button size="sm" variant="outline" className="sm:ml-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground self-end sm:self-auto" onClick={() => handleComplete(s)}>
                        Finalizar
                      </Button>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground space-y-0.5 break-words">
                      <p>Curso: {courseName}</p>
                      <p>Carga horária: {workload}h • {forecast?.weeklyHours.toFixed(1).replace('.0', '') ?? '?'}h/semana</p>
                      <p>Início do curso: {courseStart || '—'} • Primeira presença: {firstPresence || '—'}</p>
                      <p>Previsão de término: {endDate} • Status: {STATUS_LABELS[courseStatus] || courseStatus}</p>
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
