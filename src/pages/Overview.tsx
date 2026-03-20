import { useState } from 'react';
import { DayTabs } from '@/components/DayTabs';
import { TimeSlotCard } from '@/components/TimeSlotCard';
import { useTimeSlots, useSlotCounts, useSlotStudents, useCompleteStudent } from '@/hooks/use-supabase-data';
import { getTodayDayName } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function Overview() {
  const [selectedDay, setSelectedDay] = useState(getTodayDayName());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const { data: timeSlots } = useTimeSlots();
  const { data: slotCounts } = useSlotCounts();
  const { data: slotStudents } = useSlotStudents(selectedSlotId);
  const completeStudent = useCompleteStudent();

  const daySlots = timeSlots?.filter(s => s.day_of_week === selectedDay) ?? [];

  // Get first attendance for each student in the slot
  const studentIds = slotStudents?.map(s => s.students?.id).filter(Boolean) ?? [];
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

  const handleComplete = async (student: any) => {
    const courseName = student.courses?.name || student.custom_course_name || 'N/A';
    const startDate = firstDates?.[student.id] ?? null;
    completeStudent.mutate(
      { studentId: student.id, courseName, startDate },
      { onSuccess: () => { toast.success('Curso finalizado!'); setSelectedSlotId(null); } }
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Visão Geral</h1>
      <DayTabs value={selectedDay} onChange={setSelectedDay} />
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
            <DialogTitle>Alunos do Horário</DialogTitle>
          </DialogHeader>
          {slotStudents && slotStudents.length > 0 ? (
            <div className="space-y-2">
              {slotStudents.map(s => {
                const student = s.students;
                if (!student) return null;
                const courseName = student.courses?.name || student.custom_course_name || 'N/A';
                const workload = student.workload ?? 48;
                const startDate = firstDates?.[student.id] ?? '-';
                return (
                  <div key={s.id} className="flex items-center justify-between border rounded-lg p-3 bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{student.full_name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{courseName} • {workload}h • Início: {startDate}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleComplete(student)}
                    >
                      Finalizar
                    </Button>
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
