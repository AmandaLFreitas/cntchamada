import { useState } from 'react';
import { useReportData } from '@/hooks/use-supabase-data';
import { AttendanceReport } from '@/components/AttendanceReport';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, User, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CertificateDialog } from '@/components/CertificateDialog';
import type { CertificateData } from '@/lib/certificate-templates';

type ViewMode = 'cards' | 'list';
type StatusFilter = 'em_andamento' | 'finalizado' | 'desistiu';

export default function Reports() {
  const { data, isLoading } = useReportData();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('em_andamento');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const [certData, setCertData] = useState<CertificateData | null>(null);

  // Fetch all students (active and inactive) for filtering by status
  const { data: allStudents } = useQuery({
    queryKey: ['all_students_with_courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*, courses(name, workload)')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch counts by status
  const { data: statusCounts } = useQuery({
    queryKey: ['student_status_counts'],
    queryFn: async () => {
      const { data: all, error } = await supabase.from('students').select('status');
      if (error) throw error;
      const counts = { em_andamento: 0, finalizado: 0, desistiu: 0 };
      all?.forEach(s => {
        const st = s.status || 'em_andamento';
        if (st in counts) counts[st as keyof typeof counts]++;
      });
      return counts;
    },
  });

  // Fetch student schedules for detail view
  const { data: studentSchedules } = useQuery({
    queryKey: ['student_detail_schedules', selectedStudentId],
    enabled: !!selectedStudentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_schedules')
        .select('*, time_slots(*)')
        .eq('student_id', selectedStudentId!);
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance counts for selected student
  const { data: studentAttendance } = useQuery({
    queryKey: ['student_detail_attendance', selectedStudentId],
    enabled: !!selectedStudentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', selectedStudentId!);
      if (error) throw error;
      const counts = { present: 0, absent: 0, neutral: 0 };
      data?.forEach(a => {
        if (a.status === 'present') counts.present++;
        else if (a.status === 'absent') counts.absent++;
        else if (a.status === 'neutral') counts.neutral++;
      });
      return counts;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  const statusLabels: Record<StatusFilter, string> = {
    em_andamento: 'Em Andamento',
    finalizado: 'Finalizados',
    desistiu: 'Desistentes',
  };

  const handleCardClick = (status: StatusFilter) => {
    setStatusFilter(status);
    setViewMode('list');
    setSearch('');
  };

  const filteredByStatus = allStudents?.filter(s => {
    const st = s.status || 'em_andamento';
    return st === statusFilter;
  }) ?? [];

  const filteredStudents = filteredByStatus.filter(s =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStudent = allStudents?.find(s => s.id === selectedStudentId);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Relatórios</h1>

      {viewMode === 'cards' ? (
        <>
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => handleCardClick('em_andamento')}
              className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer text-left"
            >
              <p className="text-sm text-muted-foreground">Em andamento</p>
              <p className="text-3xl font-bold text-primary">{statusCounts?.em_andamento ?? 0}</p>
            </button>
            <button
              onClick={() => handleCardClick('finalizado')}
              className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer text-left"
            >
              <p className="text-sm text-muted-foreground">Finalizados</p>
              <p className="text-3xl font-bold text-green-600">{statusCounts?.finalizado ?? 0}</p>
            </button>
            <button
              onClick={() => handleCardClick('desistiu')}
              className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer text-left"
            >
              <p className="text-sm text-muted-foreground">Desistentes</p>
              <p className="text-3xl font-bold text-destructive">{statusCounts?.desistiu ?? 0}</p>
            </button>
          </div>

          {/* Active students report table */}
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
                {(data?.students ?? [])
                  .filter(s => !search || s.full_name?.toLowerCase().includes(search.toLowerCase()))
                  .map(s => {
                    const counts = data?.attendanceCounts[s.id] ?? { present: 0, absent: 0 };
                    const startDate = data?.firstAttendance[s.id] ?? '-';
                    const completion = data?.completionMap[s.id];
                    const courseName = (s.courses as any)?.name || s.custom_course_name || 'N/A';
                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedStudentId(s.id)}>
                        <td className="p-3">{s.full_name || 'Sem nome'}</td>
                        <td className="p-3">{courseName}</td>
                        <td className="p-3 text-center">
                          <span className="text-green-600 font-medium">{counts.present}</span>
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
          </div>

          <Separator className="my-8" />
          <AttendanceReport />
        </>
      ) : (
        <>
          <Button variant="ghost" className="mb-4 gap-2" onClick={() => setViewMode('cards')}>
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          <h2 className="text-xl font-semibold mb-4">{statusLabels[statusFilter]}</h2>

          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="grid gap-2">
            {filteredStudents.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStudentId(s.id)}
                className="bg-card border rounded-lg p-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
              >
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{(s.courses as any)?.name || s.custom_course_name || 'Sem curso'}</p>
                </div>
              </button>
            ))}
            {filteredStudents.length === 0 && (
              <p className="text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>
            )}
          </div>
        </>
      )}

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedStudentId} onOpenChange={() => setSelectedStudentId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.full_name || 'Aluno'}</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">CPF</p>
                  <p className="font-medium">{selectedStudent.cpf || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data de Nascimento</p>
                  <p className="font-medium">{selectedStudent.birth_date || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Endereço</p>
                  <p className="font-medium">{selectedStudent.street ? `${selectedStudent.street}, ${selectedStudent.house_number || 's/n'}` : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Matrícula</p>
                  <p className="font-medium">{selectedStudent.enrollment_date || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Curso</p>
                  <p className="font-medium">{(selectedStudent.courses as any)?.name || selectedStudent.custom_course_name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Carga Horária</p>
                  <p className="font-medium">{selectedStudent.workload}h</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedStudent.status?.replace('_', ' ') || 'Em andamento'}</p>
                </div>
                {selectedStudent.guardian_name && (
                  <>
                    <div>
                      <p className="text-muted-foreground">Responsável</p>
                      <p className="font-medium">{selectedStudent.guardian_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tel. Responsável</p>
                      <p className="font-medium">{selectedStudent.guardian_phone || '-'}</p>
                    </div>
                  </>
                )}
              </div>

              {studentAttendance && (
                <div className="border rounded-lg p-3">
                  <p className="font-medium mb-2">Frequência</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">{studentAttendance.present} presenças</span>
                    <span className="text-destructive font-medium">{studentAttendance.absent} faltas</span>
                    <span className="text-muted-foreground">{studentAttendance.neutral} neutros</span>
                  </div>
                </div>
              )}

              {studentSchedules && studentSchedules.length > 0 && (
                <div className="border rounded-lg p-3">
                  <p className="font-medium mb-2">Horários</p>
                  <div className="flex flex-wrap gap-2">
                    {studentSchedules.map(sch => (
                      <span key={sch.id} className="text-xs bg-muted px-2 py-1 rounded">
                        {(sch.time_slots as any)?.day_of_week} {(sch.time_slots as any)?.start_time}-{(sch.time_slots as any)?.end_time}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
