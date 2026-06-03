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
import { Check, X, Minus, MessageSquare, BookOpen, LifeBuoy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSchool } from '@/contexts/SchoolContext';
import { StudentObservationsDialog } from '@/components/StudentObservationsDialog';
import { StudentDetailsDialog } from '@/components/StudentDetailsDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { openWhatsApp } from '@/lib/utils';
import { useFinalizingStudents } from '@/hooks/use-finalizing-students';
import { toast } from 'sonner';


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
  const [detailsStudentId, setDetailsStudentId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { schoolId } = useSchool();

  const isoDate = format(selectedDate, 'yyyy-MM-dd');

  const { data: timeSlots } = useTimeSlots();
  const { data: slotCounts } = useSlotCounts();
  const { data: slotStudents } = useSlotStudents(selectedSlotId);
  const { data: attendance } = useAttendance(isoDate, selectedSlotId);
  const saveAttendance = useSaveAttendance();

  // When searching, find which slots (across ALL days) contain matching students
  const { data: searchSlotIds } = useQuery({
    queryKey: ['attendance_search_all', schoolId, search.trim().toLowerCase()],
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
        .select('time_slot_id')
        .eq('school_id', schoolId!)
        .in('student_id', ids);
      const set = new Set<string>();
      (scheds ?? []).forEach((r: any) => set.add(r.time_slot_id));
      return set;
    },
  });

  const isSearching = search.trim().length >= 2;
  const allDaySlots = timeSlots?.filter(s => s.day_of_week === selectedDay) ?? [];
  const daySlots = isSearching && searchSlotIds
    ? (timeSlots ?? []).filter(s => searchSlotIds.has(s.id))
    : allDaySlots;

  const searchTerm = search.trim().toLowerCase();
  const filteredStudents = (slotStudents ?? []).filter((s: any) => {
    const student = s.students;
    if (!student) return false;
    if (!isEnrolledByDate(student.enrollment_date, isoDate)) return false;
    if (searchTerm.length >= 2 && !(student.full_name || '').toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  // Check which students have never had attendance
  const studentIdsInSlot = filteredStudents.map((s: any) => s.students?.id).filter(Boolean);
  const { data: existingAttendance } = useQuery({
    queryKey: ['has_any_attendance', studentIdsInSlot, schoolId],
    enabled: studentIdsInSlot.length > 0 && !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('school_id', schoolId!)
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
    queryKey: ['obs_counts', studentIdsInSlot, schoolId],
    enabled: studentIdsInSlot.length > 0 && !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_observations')
        .select('student_id')
        .eq('school_id', schoolId!)
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
    const current = getStatus(studentId);
    // Toggle: clicking same status clears it
    const next = current === status ? '' : status;
    saveAttendance.mutate({ studentId, timeSlotId: selectedSlotId, date: isoDate, status: next });
  };

  const finalizing = useFinalizingStudents();
  const finalizingMap = new Map<string, any>();
  finalizing.forEach(f => finalizingMap.set(f.studentId, f));

  const toggleMaterial = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await (supabase as any).from('students').update({ material_sent: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slot_students'] });
      qc.invalidateQueries({ queryKey: ['students'] });
      toast.success('Apostila atualizada');
    },
  });

  const toggleRescue = useMutation({
    mutationFn: async ({ scId, value }: { scId: string; value: boolean }) => {
      const { error } = await (supabase as any).from('student_courses').update({ rescue_flagged: value }).eq('id', scId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slot_students'] });
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['rescue'] });
      toast.success('Atualizado para Resgate');
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
            <DialogTitle>Chamada - {format(selectedDate, "dd/MM/yyyy")} ({selectedDay})</DialogTitle>
          </DialogHeader>
          {filteredStudents.length > 0 ? (
            <div className="space-y-2">
              {filteredStudents.map((s: any) => {
                const student = s.students;
                if (!student) return null;
                const status = getStatus(student.id);
                const courseName = student.courses?.name || student.custom_course_name || 'N/A';
                const materialSent = !!student.material_sent;
                const fin = finalizingMap.get(student.id);
                const isFinalizing = !!fin;
                const isRescued = !!s.rescue_flagged;
                return (
                  <div key={s.id} className="border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailsStudentId(student.id)}
                        className="min-w-0 flex-1 text-left"
                        title="Ver dados do aluno"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate text-sm sm:text-base hover:underline flex items-center gap-1.5">
                            <span className="truncate">{student.full_name || 'Sem nome'}</span>
                            {(obsCounts?.get(student.id) ?? 0) > 0 && (
                              <span className="shrink-0 h-2 w-2 rounded-full bg-destructive" title="Possui observações" />
                            )}
                          </span>
                          {isNewStudent(student.id, student.enrollment_date) && (
                            <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Novo</Badge>
                          )}
                          {isFinalizing && (
                            <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0">Finalizando</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{courseName}</p>
                      </button>
                      <div className="flex gap-1.5 ml-auto sm:ml-2 flex-wrap justify-end">
                        <Button size="icon" variant="ghost" className="h-8 w-8 relative"
                          onClick={() => setObsDialogStudentId(student.id)}
                          title="Observação">
                          <MessageSquare className="h-4 w-4" />
                          {(obsCounts?.get(student.id) ?? 0) > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-card" />
                          )}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9"
                          onClick={() => toggleMaterial.mutate({ id: student.id, value: !materialSent })}
                          title={materialSent ? 'Apostila enviada (clique para desmarcar)' : 'Apostila NÃO enviada (clique para marcar)'}>
                          <BookOpen className={cn('h-5 w-5', materialSent ? 'text-blue-600' : 'text-destructive')} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => toggleRescue.mutate({ scId: s.student_course_id, value: !isRescued })}
                          title={isRescued ? 'Remover do Resgate' : 'Enviar para Resgate'}>
                          <LifeBuoy className={cn('h-4 w-4', isRescued ? 'text-orange-600 fill-orange-100' : 'text-muted-foreground')} />
                        </Button>
                        <Button size="icon" variant={status === 'present' ? 'default' : 'outline'}
                          className={status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                          onClick={() => markAttendance(student.id, 'present')} title="Presença (clique novamente para desmarcar)">
                          <Check className={cn('h-4 w-4', status !== 'present' && 'text-green-600')} />
                        </Button>
                        <Button size="icon" variant={status === 'absent' ? 'default' : 'outline'}
                          className={status === 'absent' ? 'bg-destructive hover:bg-destructive/90' : ''}
                          onClick={() => markAttendance(student.id, 'absent')} title="Falta (clique novamente para desmarcar)">
                          <X className={cn('h-4 w-4', status !== 'absent' && 'text-destructive')} />
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
      <StudentDetailsDialog
        open={!!detailsStudentId}
        onOpenChange={(open) => { if (!open) setDetailsStudentId(null); }}
        studentId={detailsStudentId}
      />
    </div>
  );
}
