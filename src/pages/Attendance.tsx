import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayTabs } from '@/components/DayTabs';
import { TimeSlotCard } from '@/components/TimeSlotCard';
import { useTimeSlots, useSlotCounts, useSlotStudents, useAttendance, useSaveAttendance } from '@/hooks/use-supabase-data';
import { getTodayDayName, DAYS_OF_WEEK } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, X, Minus, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StudentObservationsDialog } from '@/components/StudentObservationsDialog';
import { ConsecutiveAbsencesAlert } from '@/components/ConsecutiveAbsencesAlert';

const dayNameFromDate = (date: Date): string => {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const name = days[date.getDay()];
  if (name === 'Domingo' || name === 'Sexta') return 'Segunda';
  return name;
};

function isEnrolledByDate(enrollmentDate: string | null, checkDate: string): boolean {
  if (!enrollmentDate) return true;
  let isoEnrollment = enrollmentDate;
  const parts = enrollmentDate.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    isoEnrollment = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoEnrollment <= checkDate;
}

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState(getTodayDayName());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [obsDialogStudentId, setObsDialogStudentId] = useState<string | null>(null);
  const qc = useQueryClient();

  const isoDate = format(selectedDate, 'yyyy-MM-dd');

  const { data: timeSlots } = useTimeSlots();
  const { data: slotCounts } = useSlotCounts();
  const { data: slotStudents } = useSlotStudents(selectedSlotId);
  const { data: attendance } = useAttendance(isoDate, selectedSlotId);
  const saveAttendance = useSaveAttendance();

  const daySlots = timeSlots?.filter(s => s.day_of_week === selectedDay) ?? [];

  const filteredStudents = (slotStudents ?? []).filter((s: any) => {
    const student = s.students;
    if (!student) return false;
    return isEnrolledByDate(student.enrollment_date, isoDate);
  });

  // Check which students have never had attendance
  const studentIdsInSlot = filteredStudents.map((s: any) => s.students?.id).filter(Boolean);
  const { data: existingAttendance } = useQuery({
    queryKey: ['has_any_attendance', studentIdsInSlot],
    enabled: studentIdsInSlot.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id')
        .in('student_id', studentIdsInSlot)
        .eq('status', 'present')
        .limit(1000);
      const set = new Set<string>();
      data?.forEach(r => set.add(r.student_id));
      return set;
    },
  });

  // Fetch observation counts for students in the slot
  const { data: obsCounts } = useQuery({
    queryKey: ['obs_counts', studentIdsInSlot],
    enabled: studentIdsInSlot.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_observations')
        .select('student_id')
        .in('student_id', studentIdsInSlot);
      const counts = new Map<string, number>();
      data?.forEach(r => counts.set(r.student_id, (counts.get(r.student_id) || 0) + 1));
      return counts;
    },
  });

  const isNewStudent = (studentId: string, enrollmentDate: string | null): boolean => {
    if (!existingAttendance) return false;
    if (existingAttendance.has(studentId)) return false;
    // Only show "Novo" if enrollment is within 14 days
    if (!enrollmentDate) return true;
    let isoDate = enrollmentDate;
    const parts = enrollmentDate.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const enrollDate = new Date(isoDate);
    const now = new Date();
    const diffDays = (now.getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  };

  const getStatus = (studentId: string) => {
    return attendance?.find(a => a.student_id === studentId)?.status ?? null;
  };

  const markAttendance = (studentId: string, status: string) => {
    if (!selectedSlotId) return;
    saveAttendance.mutate({ studentId, timeSlotId: selectedSlotId, date: isoDate, status });
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
    // Find the nearest date matching this day
    const dayIndex = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].indexOf(day);
    if (dayIndex >= 0) {
      const current = new Date(selectedDate);
      const currentDayIndex = current.getDay();
      let diff = dayIndex - currentDayIndex;
      if (diff > 0) diff -= 7; // go to the most recent past occurrence
      if (diff === 0) return; // same day, keep date
      const newDate = new Date(current);
      newDate.setDate(current.getDate() + diff);
      setSelectedDate(newDate);
    }
  };

  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    handleDateSelect(newDate);
  };

  return (
    <div>
      <ConsecutiveAbsencesAlert />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Chamada</h1>
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

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mt-4">
        {daySlots.map(slot => (
          <TimeSlotCard key={slot.id} startTime={slot.start_time} endTime={slot.end_time} studentCount={slotCounts?.[slot.id] ?? 0} onClick={() => setSelectedSlotId(slot.id)} />
        ))}
      </div>

      <Dialog open={!!selectedSlotId} onOpenChange={() => setSelectedSlotId(null)}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Chamada - {format(selectedDate, "dd/MM/yyyy")} ({selectedDay})</DialogTitle>
          </DialogHeader>
          {filteredStudents.length > 0 ? (
            <div className="space-y-2">
              {filteredStudents.map((s: any) => {
                const student = s.students;
                if (!student) return null;
                const status = getStatus(student.id);
                const courseName = student.courses?.name || student.custom_course_name || 'N/A';
                return (
                  <div key={s.id} className="border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setObsDialogStudentId(student.id)}
                            className="font-medium truncate text-sm sm:text-base text-left hover:underline flex items-center gap-1.5"
                            title="Ver observações"
                          >
                            <span className="truncate">{student.full_name || 'Sem nome'}</span>
                            {(obsCounts?.get(student.id) ?? 0) > 0 && (
                              <span className="shrink-0 h-2 w-2 rounded-full bg-destructive" title="Possui observações" />
                            )}
                          </button>
                          {isNewStudent(student.id, student.enrollment_date) && (
                            <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Novo</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{courseName}</p>
                      </div>
                      <div className="flex gap-2 ml-auto sm:ml-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8 relative"
                          onClick={() => setObsDialogStudentId(student.id)}
                          title="Observação">
                          <MessageSquare className="h-4 w-4" />
                          {(obsCounts?.get(student.id) ?? 0) > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-card" />
                          )}
                        </Button>
                        <Button size="icon" variant={status === 'present' ? 'default' : 'outline'}
                          className={status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                          onClick={() => markAttendance(student.id, 'present')} title="Presença">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant={status === 'absent' ? 'default' : 'outline'}
                          className={status === 'absent' ? 'bg-destructive hover:bg-destructive/90' : ''}
                          onClick={() => markAttendance(student.id, 'absent')} title="Falta">
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant={status === 'neutral' ? 'default' : 'outline'}
                          className={status === 'neutral' ? 'bg-muted-foreground hover:bg-muted-foreground/90 text-white' : ''}
                          onClick={() => markAttendance(student.id, 'neutral')} title="Neutro (feriado/sem aula)">
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
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

      <StudentObservationsDialog
        open={!!obsDialogStudentId}
        onOpenChange={(open) => { if (!open) setObsDialogStudentId(null); }}
        studentId={obsDialogStudentId}
        studentName={filteredStudents.find((s: any) => s.students?.id === obsDialogStudentId)?.students?.full_name || 'Aluno'}
      />
    </div>
  );
}
