import { useState } from 'react';
import { useCompletions, useStudents } from '@/hooks/use-supabase-data';
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

  // Fetch all students (including inactive) for search
  const { data: allStudents } = useQuery({
    queryKey: ['all_students_for_cert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*, courses(name, workload)')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  // Search results from completions and students
  const searchResults = search.trim().length > 0
    ? (completions ?? []).filter(c =>
        (c.students as any)?.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // Also search in all students that don't have completions
  const studentResults = search.trim().length > 0
    ? (allStudents ?? []).filter(s => {
        const hasCompletion = completions?.some(c => c.student_id === s.id);
        return !hasCompletion && s.full_name?.toLowerCase().includes(search.toLowerCase());
      })
    : [];

  const openCertFromCompletion = (c: any) => {
    setCertData({
      studentName: (c.students as any)?.full_name || 'Sem nome',
      courseName: c.course_name || 'N/A',
      workload: 48,
      startDate: c.start_date,
      endDate: c.end_date,
    });
    setCertOpen(true);
  };

  const openCertFromStudent = (s: any) => {
    const courseName = s.courses?.name || s.custom_course_name || 'N/A';
    const today = new Date().toISOString().split('T')[0];
    setCertData({
      studentName: s.full_name || 'Sem nome',
      courseName,
      workload: s.workload ?? 48,
      startDate: s.enrollment_date ?? null,
      endDate: today,
    });
    setCertOpen(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Certificados</h1>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar aluno pelo nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {search.trim().length > 0 ? (
        <div className="space-y-2">
          {searchResults.map(c => (
            <button
              key={c.id}
              onClick={() => openCertFromCompletion(c)}
              className="w-full bg-card border rounded-lg p-3 text-left hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{(c.students as any)?.full_name || 'Sem nome'}</p>
                <p className="text-sm text-muted-foreground">{c.course_name || 'N/A'} • Finalizado em {c.end_date}</p>
              </div>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Concluído</span>
            </button>
          ))}
          {studentResults.map(s => (
            <button
              key={s.id}
              onClick={() => openCertFromStudent(s)}
              className="w-full bg-card border rounded-lg p-3 text-left hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{s.full_name || 'Sem nome'}</p>
                <p className="text-sm text-muted-foreground">{(s.courses as any)?.name || s.custom_course_name || 'Sem curso'}</p>
              </div>
              <span className="text-xs bg-muted px-2 py-1 rounded capitalize">{s.status?.replace('_', ' ') || 'Em andamento'}</span>
            </button>
          ))}
          {searchResults.length === 0 && studentResults.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">
          Digite o nome do aluno para buscar e gerar o certificado.
        </p>
      )}

      {certData && (
        <CertificateDialog open={certOpen} onOpenChange={setCertOpen} data={certData} />
      )}
    </div>
  );
}
