import { useState } from 'react';
import { useReportData } from '@/hooks/use-supabase-data';
import { AttendanceReport } from '@/components/AttendanceReport';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function Reports() {
  const { data, isLoading } = useReportData();
  const [search, setSearch] = useState('');

  // Fetch counts by status
  const { data: statusCounts } = useQuery({
    queryKey: ['student_status_counts'],
    queryFn: async () => {
      const { data: all, error } = await supabase.from('students').select('status');
      if (error) throw error;
      const counts = { em_andamento: 0, finalizado: 0, desistiu: 0 };
      all?.forEach(s => {
        const st = (s as any).status || 'em_andamento';
        if (st in counts) counts[st as keyof typeof counts]++;
      });
      return counts;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  const activeStudents = (data?.students ?? []).filter(s =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Relatórios</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Em andamento</p>
          <p className="text-3xl font-bold text-primary">{statusCounts?.em_andamento ?? 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Finalizados</p>
          <p className="text-3xl font-bold text-success">{statusCounts?.finalizado ?? 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Desistentes</p>
          <p className="text-3xl font-bold text-destructive">{statusCounts?.desistiu ?? 0}</p>
        </div>
      </div>

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
              <th className="text-center p-3 font-medium">Presenças</th>
              <th className="text-center p-3 font-medium">Faltas</th>
              <th className="text-left p-3 font-medium">Início</th>
              <th className="text-left p-3 font-medium">Fim</th>
            </tr>
          </thead>
          <tbody>
            {activeStudents.map(s => {
              const counts = data?.attendanceCounts[s.id] ?? { present: 0, absent: 0 };
              const startDate = data?.firstAttendance[s.id] ?? '-';
              const completion = data?.completionMap[s.id];
              const courseName = (s.courses as any)?.name || s.custom_course_name || 'N/A';
              return (
                <tr key={s.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">{s.full_name || 'Sem nome'}</td>
                  <td className="p-3">{courseName}</td>
                  <td className="p-3 text-center">
                    <span className="text-success font-medium">{counts.present}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-destructive font-medium">{counts.absent}</span>
                  </td>
                  <td className="p-3">{startDate}</td>
                  <td className="p-3">{completion?.end_date ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {activeStudents.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Nenhum aluno ativo.</p>
        )}
      </div>

      <Separator className="my-8" />

      <AttendanceReport />
    </div>
  );
}
