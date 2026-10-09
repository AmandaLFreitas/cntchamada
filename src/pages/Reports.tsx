import { useEffect, useState } from 'react';
import { useReportData } from '@/hooks/use-supabase-data';
import { AttendanceReport } from '@/components/AttendanceReport';
import { MonthlyReports } from '@/components/MonthlyReports';
import { EnrollmentsReport } from '@/components/EnrollmentsReport';
import { TrialLessonsScheduledReport } from '@/components/TrialLessonsScheduledReport';
import { CompletionPlanningReport } from '@/components/CompletionPlanningReport';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, User, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CertificateDialog } from '@/components/CertificateDialog';
import type { CertificateData } from '@/lib/certificate-templates';
import { useAuth } from '@/contexts/AuthContext';
import { REPORT_STATUS_LABELS, reportCourseName, type ReportStatus } from '@/lib/report-status';

type ViewMode = 'cards' | 'list';
type StatusFilter = ReportStatus;

export default function Reports() {
  const { data, isLoading, isError, refetch } = useReportData();
  const { isAdmin } = useAuth();
  const { schoolId } = useSchool();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('em_andamento');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const [certData, setCertData] = useState<CertificateData | null>(null);

  useEffect(() => {
    setSelectedStudentId(null);
    setCertOpen(false);
    setCertData(null);
  }, [schoolId]);

  const statusCounts = data?.statusCounts;

  const { data: studentSchedules } = useQuery({
    queryKey: ['student_detail_schedules', selectedStudentId, schoolId],
    enabled: !!selectedStudentId && !!schoolId,
    queryFn: async () => {
      if (!schoolId || !selectedStudentId) return null;
      const { data, error } = await supabase
        .from('student_schedules')
        .select('*, time_slots(*)')
        .eq('school_id', schoolId)
        .eq('student_id', selectedStudentId);
      if (error) throw error;
      return data;
    },
  });

  const { data: studentAttendance } = useQuery({
    queryKey: ['student_detail_attendance', selectedStudentId, schoolId],
    enabled: !!selectedStudentId && !!schoolId,
    queryFn: async () => {
      if (!schoolId || !selectedStudentId) return null;
      const { data, error } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('school_id', schoolId)
        .eq('student_id', selectedStudentId);
      if (error) throw error;
      // Collapse per date
      const byDate = new Map<string, { hasPresent: boolean; hasAbsent: boolean }>();
      (data ?? []).forEach((r: any) => {
        const cur = byDate.get(r.date) || { hasPresent: false, hasAbsent: false };
        if (r.status === 'present') cur.hasPresent = true;
        else if (r.status === 'absent') cur.hasAbsent = true;
        byDate.set(r.date, cur);
      });
      const counts = { present: 0, absent: 0, neutral: 0 };
      byDate.forEach(v => {
        if (v.hasPresent) counts.present += 1;
        else if (v.hasAbsent) counts.absent += 1;
        else counts.neutral += 1;
      });
      return counts;
    },
  });


  if (isError) return <div role="alert" className="space-y-3"><p className="text-destructive">Não foi possível carregar os relatórios.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div>;
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

  const uniqueStudents = data?.studentsByStatus[statusFilter] ?? [];

  const filteredStudents = uniqueStudents.filter(s =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStudent = uniqueStudents.find((s: any) => s.id === selectedStudentId);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Relatórios</h1>

      {viewMode === 'cards' ? (
        <>
          <div className="flex flex-wrap gap-4 mb-6">
            <Button variant="outline" onClick={() => handleCardClick('em_andamento')} className="bg-card h-auto whitespace-normal items-start flex-col gap-0 border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer text-left">
              <p className="text-sm text-muted-foreground">Em andamento</p>
              <p className="text-3xl font-bold text-primary">{statusCounts?.em_andamento ?? 0}</p>
            </Button>
            <Button variant="outline" onClick={() => handleCardClick('finalizado')} className="bg-card h-auto whitespace-normal items-start flex-col gap-0 border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer text-left">
              <p className="text-sm text-muted-foreground">Finalizados</p>
              <p className="text-3xl font-bold text-green-600">{statusCounts?.finalizado ?? 0}</p>
            </Button>
            <Button variant="outline" onClick={() => handleCardClick('desistiu')} className="bg-card h-auto whitespace-normal items-start flex-col gap-0 border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer text-left">
              <p className="text-sm text-muted-foreground">Desistentes</p>
              <p className="text-3xl font-bold text-destructive">{statusCounts?.desistiu ?? 0}</p>
            </Button>
          </div>

          <Separator className="my-6" />
          <CompletionPlanningReport />

          <Separator className="my-6" />
          <MonthlyReports />

          <Separator className="my-6" />
          <EnrollmentsReport />

          <Separator className="my-6" />
          <TrialLessonsScheduledReport />


          <Separator className="my-6" />
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
            {filteredStudents.map((s: any) => (
              <Button variant="outline" key={s.id} onClick={() => setSelectedStudentId(s.id)}
                className="bg-card h-auto whitespace-normal justify-start text-foreground border rounded-lg p-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left w-full">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.full_name || 'Sem nome'}</p>
                  {s.enrollments.map(enrollment => (
                    <p key={enrollment.id} className="text-sm text-muted-foreground break-words">
                      {reportCourseName(enrollment)} · {enrollment.workload}h · {REPORT_STATUS_LABELS[statusFilter]}
                    </p>
                  ))}
                </div>
              </Button>
            ))}
            {filteredStudents.length === 0 && (
              <p className="text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>
            )}
          </div>
        </>
      )}

      <Dialog open={!!selectedStudentId} onOpenChange={() => setSelectedStudentId(null)}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.full_name || 'Aluno'}</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {isAdmin && <div><p className="text-muted-foreground">CPF</p><p className="font-medium">{selectedStudent.cpf || '-'}</p></div>}
                <div><p className="text-muted-foreground">Data de Nascimento</p><p className="font-medium">{selectedStudent.birth_date || '-'}</p></div>
                {isAdmin && <div><p className="text-muted-foreground">Endereço</p><p className="font-medium">{selectedStudent.street ? `${selectedStudent.street}, ${selectedStudent.house_number || 's/n'}` : '-'}</p></div>}
              </div>
              <div className="space-y-3">
                {selectedStudent.enrollments.map(enrollment => (
                  <div key={enrollment.id} className="border-b pb-3 text-sm">
                    <p className="font-medium">{reportCourseName(enrollment)}</p>
                    <p className="text-muted-foreground">{enrollment.workload}h · {REPORT_STATUS_LABELS[statusFilter]}</p>
                    {enrollment.status === 'finalizado' && (
                      <Button variant="outline" className="mt-2 gap-2" onClick={() => {
                        setCertData({ studentName: selectedStudent.full_name || 'Sem nome',
                          courseName: reportCourseName(enrollment), workload: enrollment.workload,
                          startDate: null, endDate: new Date().toISOString().split('T')[0] });
                        setCertOpen(true);
                      }}><FileText className="h-4 w-4" /> Gerar Certificado</Button>
                    )}
                  </div>
                ))}
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

      {certData && <CertificateDialog open={certOpen} onOpenChange={setCertOpen} data={certData} />}
    </div>
  );
}
