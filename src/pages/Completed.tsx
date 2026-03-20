import { useState } from 'react';
import { useCompletions } from '@/hooks/use-supabase-data';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { CertificateDialog } from '@/components/CertificateDialog';
import type { CertificateData } from '@/lib/certificate-templates';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function Completed() {
  const { data: completions, isLoading } = useCompletions();
  const [search, setSearch] = useState('');
  const [certOpen, setCertOpen] = useState(false);
  const [certData, setCertData] = useState<CertificateData | null>(null);

  // Only finalized students (not desistiu)
  const { data: finalizedStudents } = useQuery({
    queryKey: ['finalized_students_for_cert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*, courses(name, workload)')
        .eq('status', 'finalizado')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  // Search in finalized students and completions
  const searchResults = search.trim().length > 0
    ? (finalizedStudents ?? []).filter(s =>
        s.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : (finalizedStudents ?? []);

  const openCert = (s: any) => {
    const completion = completions?.find(c => c.student_id === s.id);
    const courseName = (s.courses as any)?.name || s.custom_course_name || completion?.course_name || 'N/A';
    const today = new Date().toISOString().split('T')[0];
    setCertData({
      studentName: s.full_name || 'Sem nome',
      courseName,
      workload: s.workload ?? 48,
      startDate: s.enrollment_date ?? completion?.start_date ?? null,
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
        <Input
          placeholder="Buscar aluno pelo nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {searchResults.length > 0 ? (
        <div className="space-y-2">
          {searchResults.map(s => {
            const courseName = (s.courses as any)?.name || s.custom_course_name || 'Sem curso';
            return (
              <button
                key={s.id}
                onClick={() => openCert(s)}
                className="w-full bg-card border rounded-lg p-3 text-left hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{s.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{courseName}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Finalizado</span>
              </button>
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
