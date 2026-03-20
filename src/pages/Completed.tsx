import { useState } from 'react';
import { useCompletions } from '@/hooks/use-supabase-data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Award } from 'lucide-react';
import { CertificateDialog } from '@/components/CertificateDialog';
import type { CertificateData } from '@/lib/certificate-templates';

export default function Completed() {
  const { data: completions, isLoading } = useCompletions();
  const [search, setSearch] = useState('');
  const [certOpen, setCertOpen] = useState(false);
  const [certData, setCertData] = useState<CertificateData | null>(null);

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  const filtered = completions?.filter(c =>
    !search || (c.students as any)?.full_name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const openCert = (c: any) => {
    setCertData({
      studentName: (c.students as any)?.full_name || 'Sem nome',
      courseName: c.course_name || 'N/A',
      workload: 48,
      startDate: c.start_date,
      endDate: c.end_date,
    });
    setCertOpen(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Finalizados</h1>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Curso</th>
              <th className="text-left p-3 font-medium">Início</th>
              <th className="text-left p-3 font-medium">Fim</th>
              <th className="text-left p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b hover:bg-muted/30">
                <td className="p-3">{(c.students as any)?.full_name || 'Sem nome'}</td>
                <td className="p-3">{c.course_name || 'N/A'}</td>
                <td className="p-3">{c.start_date ?? '-'}</td>
                <td className="p-3">{c.end_date}</td>
                <td className="p-3">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openCert(c)}>
                    <Award className="h-3.5 w-3.5" /> Certificado
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Nenhum aluno finalizado.</p>
        )}
      </div>

      {certData && (
        <CertificateDialog open={certOpen} onOpenChange={setCertOpen} data={certData} />
      )}
    </div>
  );
}
