import { useState } from 'react';
import { useCompletions } from '@/hooks/use-supabase-data';
import { Input } from '@/components/ui/input';
import { Search, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CertificateDialog } from '@/components/CertificateDialog';
import type { CertificateData } from '@/lib/certificate-templates';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSchool } from '@/contexts/SchoolContext';
import { toast } from 'sonner';

export default function Completed() {
  const { data: completions, isLoading } = useCompletions();
  const { schoolId } = useSchool();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [certOpen, setCertOpen] = useState(false);
  const [certData, setCertData] = useState<CertificateData | null>(null);

  // Get finalized student_courses with student info
  const { data: finalizedCourses } = useQuery({
    queryKey: ['finalized_student_courses', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('student_courses')
        .select('*, students(id, full_name), courses(name, workload)')
        .eq('school_id', schoolId!)
        .eq('status', 'finalizado')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleRescue = useMutation({
    mutationFn: async ({ scId, value }: { scId: string; value: boolean }) => {
      const { error } = await (supabase as any)
        .from('student_courses')
        .update({ rescue_flagged: value })
        .eq('id', scId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finalized_student_courses'] });
      qc.invalidateQueries({ queryKey: ['rescue'] });
      qc.invalidateQueries({ queryKey: ['rescue_flags'] });
      toast.success('Atualizado');
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  const searchResults = search.trim().length > 0
    ? (finalizedCourses ?? []).filter((sc: any) =>
        sc.students?.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : (finalizedCourses ?? []);

  const openCert = (sc: any) => {
    const completion = completions?.find(c => c.student_id === sc.student_id);
    const courseName = sc.courses?.name || sc.custom_course_name || completion?.course_name || 'N/A';
    const today = new Date().toISOString().split('T')[0];
    setCertData({
      studentName: sc.students?.full_name || 'Sem nome',
      courseName,
      workload: sc.workload ?? 48,
      startDate: sc.enrollment_date ?? completion?.start_date ?? null,
      endDate: completion?.end_date ?? today,
    });
    setCertOpen(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Certificados</h1>
      <p className="text-sm text-muted-foreground mb-4">Disponível apenas para alunos com status <strong>Finalizado</strong>.</p>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar aluno pelo nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {searchResults.length > 0 ? (
        <div className="space-y-2">
          {searchResults.map((sc: any) => {
            const courseName = sc.courses?.name || sc.custom_course_name || 'Sem curso';
            const isRescued = !!sc.rescue_flagged;
            return (
              <div key={sc.id} className="w-full bg-card border rounded-lg p-3 flex items-center justify-between gap-2">
                <button onClick={() => openCert(sc)} className="text-left flex-1 min-w-0 hover:opacity-80">
                  <p className="font-medium truncate">{sc.students?.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground truncate">{courseName}</p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); toggleRescue.mutate({ scId: sc.id, value: !isRescued }); }}
                    title={isRescued ? 'Remover do Resgate' : 'Enviar para Resgate'}
                  >
                    <LifeBuoy className={`h-4 w-4 ${isRescued ? 'text-orange-600 fill-orange-100' : 'text-muted-foreground'}`} />
                  </Button>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Finalizado</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">
          {search.trim() ? 'Nenhum aluno finalizado encontrado.' : 'Nenhum aluno finalizado.'}
        </p>
      )}

      {certData && (
        <CertificateDialog open={certOpen} onOpenChange={setCertOpen} data={certData} />
      )}
    </div>
  );
}
