import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { useFinalizingStudents } from '@/hooks/use-finalizing-students';
import { useCoursesProgress } from '@/hooks/use-courses-progress';
import { useCourses } from '@/hooks/use-supabase-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LifeBuoy, X } from 'lucide-react';
import { openWhatsApp } from '@/lib/utils';
import { toast } from 'sonner';

const CONTACT_STATUSES = [
  { value: 'contatado', label: 'Entramos em contato' },
  { value: 'fechou', label: 'Entramos em contato e FECHOU' },
  { value: 'nao_fechou', label: 'Não fechou' },
  { value: 'esperar', label: 'Vai esperar para fechar depois' },
] as const;

const contactRowClass = (status: string | null | undefined) => {
  switch (status) {
    case 'fechou': return 'bg-green-200/70 hover:bg-green-300/70 border-l-4 border-l-green-600';
    case 'nao_fechou': return 'bg-red-50/70';
    case 'esperar': return 'bg-yellow-50/70';
    case 'contatado': return 'bg-blue-50/70';
    default: return 'bg-orange-50/40';
  }
};

export default function Rescue() {
  const { schoolId } = useSchool();
  const qc = useQueryClient();
  const finalizing = useFinalizingStudents();
  const { data: courses = [] } = useCourses();

  const { data: flagged = [] } = useQuery({
    queryKey: ['rescue', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('student_courses')
        .select('id, student_id, course_id, custom_course_name, workload, rescue_flagged, rescue_next_course_id, rescue_observations, rescue_contact_status, courses(name), students(full_name, guardian_phone)')
        .eq('school_id', schoolId!)
        .eq('rescue_flagged', true);
      if (error) throw error;
      return data || [];
    },
  });

  const finalizingMap = useMemo(() => {
    const m = new Map<string, typeof finalizing[number]>();
    finalizing.forEach(f => m.set(f.studentCourseId, f));
    return m;
  }, [finalizing]);

  const updateField = useMutation({
    mutationFn: async ({ scId, patch }: { scId: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any).from('student_courses').update(patch).eq('id', scId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rescue'] });
    },
  });

  const unflag = useMutation({
    mutationFn: async (scId: string) => {
      const { error } = await (supabase as any).from('student_courses').update({ rescue_flagged: false }).eq('id', scId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rescue'] });
      qc.invalidateQueries({ queryKey: ['rescue_flags'] });
      qc.invalidateQueries({ queryKey: ['slot_students'] });
      qc.invalidateQueries({ queryKey: ['finalized_student_courses'] });
      toast.success('Removido do Resgate');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LifeBuoy className="h-6 w-6 text-orange-600" />
        <h1 className="text-2xl font-bold text-foreground">Resgate</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Lista de alunos marcados manualmente para acompanhamento de fechamento de novo curso.
        Para adicionar um aluno, clique no ícone de Resgate (boia) na Chamada, em Alunos ou em Certificados.
      </p>

      {flagged.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Nenhum aluno em resgate no momento.
        </p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Curso atual</TableHead>
                <TableHead className="text-center">Horas restantes</TableHead>
                <TableHead className="text-center">Aulas restantes</TableHead>
                <TableHead className="min-w-[180px]">Próximo curso</TableHead>
                <TableHead className="min-w-[180px]">Status de contato</TableHead>
                <TableHead className="min-w-[200px]">Observações</TableHead>
                <TableHead className="w-[60px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flagged.map((sc: any) => {
                const fin = finalizingMap.get(sc.id);
                const courseName = sc.courses?.name || sc.custom_course_name || '—';
                const phone = sc.students?.guardian_phone || null;
                return (
                  <TableRow key={sc.id} className={contactRowClass(sc.rescue_contact_status)}>
                    <TableCell className="font-medium">
                      <button
                        onClick={() => openWhatsApp(phone)}
                        className="text-left hover:underline hover:text-green-700"
                        title={phone ? 'Abrir WhatsApp' : 'Sem telefone'}
                      >
                        {sc.students?.full_name || '—'}
                      </button>
                    </TableCell>
                    <TableCell>{courseName}</TableCell>
                    <TableCell className="text-center font-semibold text-orange-700">
                      {fin ? `${fin.hoursRemaining}h` : '—'}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {fin ? fin.lessonsRemaining : '—'}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={sc.rescue_next_course_id || ''}
                        onValueChange={(v) => updateField.mutate({ scId: sc.id, patch: { rescue_next_course_id: v || null } })}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          {courses?.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={sc.rescue_contact_status || ''}
                        onValueChange={(v) => updateField.mutate({ scId: sc.id, patch: { rescue_contact_status: v || null } })}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          {CONTACT_STATUSES.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={sc.rescue_observations || ''}
                        placeholder="Observação..."
                        className="h-8 text-xs bg-background"
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== (sc.rescue_observations || '')) {
                            updateField.mutate({ scId: sc.id, patch: { rescue_observations: v || null } });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        title="Remover do Resgate"
                        onClick={() => unflag.mutate(sc.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
