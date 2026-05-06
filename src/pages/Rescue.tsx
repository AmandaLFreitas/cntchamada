import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { useFinalizingStudents } from '@/hooks/use-finalizing-students';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { LifeBuoy, X } from 'lucide-react';
import { openWhatsApp } from '@/lib/utils';
import { toast } from 'sonner';

interface RescueRow {
  studentId: string;
  studentCourseId: string;
  name: string;
  course: string;
  phone: string | null;
  expectedEndDate: string | null;
  hoursRemaining: number;
  pct: number;
  manual: boolean;
}

export default function Rescue() {
  const { schoolId } = useSchool();
  const qc = useQueryClient();
  const finalizing = useFinalizingStudents();

  // Fetch all manually flagged courses
  const { data: flagged = [] } = useQuery({
    queryKey: ['rescue', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('student_courses')
        .select('id, student_id, course_id, custom_course_name, rescue_flagged, courses(name), students(full_name, guardian_phone)')
        .eq('school_id', schoolId!)
        .eq('rescue_flagged', true)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const unflag = useMutation({
    mutationFn: async (scId: string) => {
      const { error } = await (supabase as any).from('student_courses').update({ rescue_flagged: false }).eq('id', scId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rescue'] });
      qc.invalidateQueries({ queryKey: ['slot_students'] });
      toast.success('Removido do Resgate');
    },
  });

  const rows = useMemo<RescueRow[]>(() => {
    const map = new Map<string, RescueRow>();
    // Auto: students finishing within 30 days (already filtered >=80% in hook)
    finalizing.forEach(f => {
      map.set(f.studentCourseId, {
        studentId: f.studentId,
        studentCourseId: f.studentCourseId,
        name: f.name,
        course: f.course,
        phone: null,
        expectedEndDate: f.expectedEndDate,
        hoursRemaining: f.hoursRemaining,
        pct: f.pct,
        manual: false,
      });
    });
    // Manual flags
    flagged.forEach((sc: any) => {
      const existing = map.get(sc.id);
      if (existing) {
        existing.manual = true;
        existing.phone = sc.students?.guardian_phone || existing.phone;
      } else {
        map.set(sc.id, {
          studentId: sc.student_id,
          studentCourseId: sc.id,
          name: sc.students?.full_name || '—',
          course: sc.courses?.name || sc.custom_course_name || '—',
          phone: sc.students?.guardian_phone || null,
          expectedEndDate: null,
          hoursRemaining: 0,
          pct: 0,
          manual: true,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.pct - a.pct);
  }, [finalizing, flagged]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LifeBuoy className="h-6 w-6 text-orange-600" />
        <h1 className="text-2xl font-bold text-foreground">Resgate</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Alunos próximos de finalizar o curso (aprox. 1 mês para o término) ou marcados manualmente para contato. Os alunos continuam normalmente na chamada — esta lista é apenas uma cópia para acompanhamento.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Nenhum aluno em resgate no momento.
        </p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="hidden md:table-cell">Previsão Término</TableHead>
                <TableHead className="text-center">Horas Restantes</TableHead>
                <TableHead className="min-w-[160px]">Conclusão</TableHead>
                <TableHead className="w-[80px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.studentCourseId} className="bg-orange-50/50">
                  <TableCell className="font-medium">
                    <button
                      onClick={() => openWhatsApp(r.phone)}
                      className="text-left hover:underline hover:text-green-700"
                      title={r.phone ? 'Abrir WhatsApp' : 'Sem telefone'}
                    >
                      {r.name}
                    </button>
                  </TableCell>
                  <TableCell>{r.course}</TableCell>
                  <TableCell className="hidden md:table-cell">{r.expectedEndDate || '—'}</TableCell>
                  <TableCell className="text-center font-semibold text-orange-700">
                    {r.hoursRemaining}h
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.pct} className="h-2 flex-1" />
                      <span className="text-xs font-medium w-10 text-right">{r.pct}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.manual && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        title="Remover do Resgate"
                        onClick={() => unflag.mutate(r.studentCourseId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
