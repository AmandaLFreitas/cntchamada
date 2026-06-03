import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PhotoLightbox } from '@/components/PhotoLightbox';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  desistiu: 'Desistiu',
};

export function StudentDetailsDialog({ open, onOpenChange, studentId }: Props) {
  const { schoolId } = useSchool();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['student_details', studentId, schoolId],
    enabled: open && !!studentId && !!schoolId,
    queryFn: async () => {
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId!)
        .maybeSingle();
      const { data: scs } = await (supabase as any)
        .from('student_courses')
        .select('*, courses(name)')
        .eq('school_id', schoolId!)
        .eq('student_id', studentId!);
      const scIds = (scs ?? []).map((sc: any) => sc.id);
      let schedulesByScId: Record<string, any[]> = {};
      if (scIds.length > 0) {
        const { data: scheds } = await supabase
          .from('student_schedules')
          .select('student_course_id, time_slots(day_of_week, start_time, end_time)')
          .in('student_course_id', scIds);
        (scheds ?? []).forEach((row: any) => {
          const k = row.student_course_id;
          if (!schedulesByScId[k]) schedulesByScId[k] = [];
          if (row.time_slots) schedulesByScId[k].push(row.time_slots);
        });
      }
      return { student, courses: scs ?? [], schedulesByScId };
    },
  });

  const student = data?.student;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{student?.full_name || 'Aluno'}</DialogTitle>
        </DialogHeader>
        {!student ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-3 text-sm">
            {(data?.courses ?? []).length === 0 && (
              <p className="text-muted-foreground">Sem cursos cadastrados.</p>
            )}
            {(data?.courses ?? []).map((sc: any) => {
              const scheds = data?.schedulesByScId[sc.id] ?? [];
              return (
                <div key={sc.id} className="border rounded-lg p-3 space-y-1">
                  <p className="font-semibold">{sc.courses?.name || sc.custom_course_name || 'Sem curso'}</p>
                  <p><span className="text-muted-foreground">Início:</span> {sc.first_class_date || sc.enrollment_date || '—'}</p>
                  <p><span className="text-muted-foreground">Carga horária:</span> {sc.workload}h</p>
                  <p><span className="text-muted-foreground">Status:</span> {STATUS_LABELS[sc.status] || sc.status}</p>
                  <div>
                    <span className="text-muted-foreground">Horários:</span>
                    {scheds.length === 0 ? (
                      <span className="ml-1">—</span>
                    ) : (
                      <ul className="ml-4 list-disc">
                        {scheds.map((t: any, i: number) => (
                          <li key={i}>{t.day_of_week} {t.start_time}–{t.end_time}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
