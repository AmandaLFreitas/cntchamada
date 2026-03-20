import { useState } from 'react';
import { DayTabs } from '@/components/DayTabs';
import { TimeSlotCard } from '@/components/TimeSlotCard';
import { useTimeSlots, useSlotCounts, useSlotStudents, useAttendance, useSaveAttendance } from '@/hooks/use-supabase-data';
import { getTodayDayName } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Minus } from 'lucide-react';

function getDayNameFromDate(dateStr: string): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const date = new Date(dateStr + 'T12:00:00');
  const name = days[date.getDay()];
  if (name === 'Domingo' || name === 'Sexta') return 'Segunda';
  return name;
}

export default function Attendance() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const selectedDay = getDayNameFromDate(selectedDate);

  const { data: timeSlots } = useTimeSlots();
  const { data: slotCounts } = useSlotCounts();
  const { data: slotStudents } = useSlotStudents(selectedSlotId);
  const { data: attendance } = useAttendance(selectedDate, selectedSlotId);
  const saveAttendance = useSaveAttendance();

  const daySlots = timeSlots?.filter(s => s.day_of_week === selectedDay) ?? [];

  const getStatus = (studentId: string) => {
    return attendance?.find(a => a.student_id === studentId)?.status ?? null;
  };

  const markAttendance = (studentId: string, status: string) => {
    if (!selectedSlotId) return;
    saveAttendance.mutate({ studentId, timeSlotId: selectedSlotId, date: selectedDate, status });
  };

  const handleDayChange = (day: string) => {
    const current = new Date(selectedDate + 'T12:00:00');
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const targetDow = days.indexOf(day);
    const currentDow = current.getDay();
    let diff = targetDow - currentDow;
    if (diff > 3) diff -= 7;
    if (diff < -3) diff += 7;
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + diff);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">Chamada</h1>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Data:</Label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
        </div>
      </div>

      <DayTabs value={selectedDay} onChange={handleDayChange} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {daySlots.map(slot => (
          <TimeSlotCard
            key={slot.id}
            startTime={slot.start_time}
            endTime={slot.end_time}
            studentCount={slotCounts?.[slot.id] ?? 0}
            onClick={() => setSelectedSlotId(slot.id)}
          />
        ))}
      </div>

      <Dialog open={!!selectedSlotId} onOpenChange={() => setSelectedSlotId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Chamada - {selectedDate} ({selectedDay})</DialogTitle>
          </DialogHeader>
          {slotStudents && slotStudents.length > 0 ? (
            <div className="space-y-2">
              {slotStudents.map(s => {
                const student = s.students;
                if (!student) return null;
                const status = getStatus(student.id);
                const courseName = student.courses?.name || student.custom_course_name || 'N/A';
                return (
                  <div key={s.id} className="flex items-center justify-between border rounded-lg p-3 bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{student.full_name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{courseName}</p>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <Button
                        size="icon"
                        variant={status === 'present' ? 'default' : 'outline'}
                        className={status === 'present' ? 'bg-success hover:bg-success/90' : ''}
                        onClick={() => markAttendance(student.id, 'present')}
                        title="Presença"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant={status === 'absent' ? 'default' : 'outline'}
                        className={status === 'absent' ? 'bg-destructive hover:bg-destructive/90' : ''}
                        onClick={() => markAttendance(student.id, 'absent')}
                        title="Falta"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant={status === 'neutral' ? 'default' : 'outline'}
                        className={status === 'neutral' ? 'bg-muted-foreground hover:bg-muted-foreground/90 text-white' : ''}
                        onClick={() => markAttendance(student.id, 'neutral')}
                        title="Neutro (feriado/sem aula)"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
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
