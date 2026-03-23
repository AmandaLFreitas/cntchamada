import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Search, User, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type DetailView = 'active' | 'finalized' | 'dropouts' | null;

export function MonthlyReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const { data: stats } = useQuery({
    queryKey: ['monthly_stats', month, year],
    queryFn: async () => {
      const { data: active } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'em_andamento');

      const { data: finalized } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'finalizado')
        .gte('updated_at', startDate)
        .lte('updated_at', endDate + 'T23:59:59');

      const { data: dropouts } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'desistiu')
        .gte('updated_at', startDate)
        .lte('updated_at', endDate + 'T23:59:59');

      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, time_slot_id')
        .gte('date', startDate)
        .lte('date', endDate);

      return {
        active: active?.length ?? 0,
        finalized: finalized?.length ?? 0,
        dropouts: dropouts?.length ?? 0,
        totalPresencas: attendance?.filter(a => a.status === 'present').length ?? 0,
        totalFaltas: attendance?.filter(a => a.status === 'absent').length ?? 0,
      };
    },
  });

  // Fetch students for detail view
  const { data: detailStudents } = useQuery({
    queryKey: ['monthly_detail_students', detailView, month, year],
    enabled: !!detailView,
    queryFn: async () => {
      if (detailView === 'active') {
        const { data } = await supabase
          .from('students')
          .select('*, courses(name, workload)')
          .eq('status', 'em_andamento')
          .order('full_name');
        return data ?? [];
      }
      if (detailView === 'finalized') {
        const { data } = await supabase
          .from('students')
          .select('*, courses(name, workload)')
          .eq('status', 'finalizado')
          .gte('updated_at', startDate)
          .lte('updated_at', endDate + 'T23:59:59')
          .order('full_name');
        return data ?? [];
      }
      if (detailView === 'dropouts') {
        const { data } = await supabase
          .from('students')
          .select('*, courses(name, workload)')
          .eq('status', 'desistiu')
          .gte('updated_at', startDate)
          .lte('updated_at', endDate + 'T23:59:59')
          .order('full_name');
        return data ?? [];
      }
      return [];
    },
  });

  // Fetch schedules for selected student
  const { data: studentSchedules } = useQuery({
    queryKey: ['monthly_student_schedules', selectedStudentId],
    enabled: !!selectedStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_schedules')
        .select('*, time_slots(*)')
        .eq('student_id', selectedStudentId!);
      return data ?? [];
    },
  });

  // Fetch attendance for selected student
  const { data: studentAttendance } = useQuery({
    queryKey: ['monthly_student_attendance', selectedStudentId],
    enabled: !!selectedStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('student_id', selectedStudentId!)
        .order('date', { ascending: true });
      return data ?? [];
    },
  });

  const selectedStudent = detailStudents?.find(s => s.id === selectedStudentId);

  const filteredDetail = detailStudents?.filter(s =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const detailLabels: Record<string, string> = {
    active: 'Alunos Ativos',
    finalized: 'Alunos Finalizados',
    dropouts: 'Alunos Desistentes',
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // Individual report calculations
  const attendanceSummary = studentAttendance ? {
    present: studentAttendance.filter(a => a.status === 'present').length,
    absent: studentAttendance.filter(a => a.status === 'absent').length,
    neutral: studentAttendance.filter(a => a.status === 'neutral').length,
  } : null;

  const frequencyPercent = attendanceSummary
    ? attendanceSummary.present + attendanceSummary.absent > 0
      ? ((attendanceSummary.present / (attendanceSummary.present + attendanceSummary.absent)) * 100).toFixed(1)
      : '0'
    : '0';

  const handlePrintReport = () => window.print();

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`relatorio-${selectedStudent?.full_name ?? 'aluno'}.pdf`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Relatório Mensal</h2>
      <div className="flex gap-3">
        <div>
          <Label className="text-xs">Mês</Label>
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ano</Label>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button onClick={() => { setDetailView('active'); setSearch(''); }} className="bg-card border rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold text-primary">{stats?.active ?? 0}</p>
        </button>
        <button onClick={() => { setDetailView('finalized'); setSearch(''); }} className="bg-card border rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <p className="text-sm text-muted-foreground">Finalizados</p>
          <p className="text-2xl font-bold text-green-600">{stats?.finalized ?? 0}</p>
        </button>
        <button onClick={() => { setDetailView('dropouts'); setSearch(''); }} className="bg-card border rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <p className="text-sm text-muted-foreground">Desistentes</p>
          <p className="text-2xl font-bold text-destructive">{stats?.dropouts ?? 0}</p>
        </button>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Presenças</p>
          <p className="text-2xl font-bold text-green-600">{stats?.totalPresencas ?? 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Faltas</p>
          <p className="text-2xl font-bold text-destructive">{stats?.totalFaltas ?? 0}</p>
        </div>
      </div>

      {/* Detail View Dialog */}
      <Dialog open={!!detailView} onOpenChange={() => { setDetailView(null); setSelectedStudentId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedStudentId ? (
                <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => setSelectedStudentId(null)}>
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>
              ) : null}
              {selectedStudentId ? (selectedStudent?.full_name ?? 'Aluno') : (detailView ? `${detailLabels[detailView]} - ${MONTHS[month]} ${year}` : '')}
            </DialogTitle>
          </DialogHeader>

          {!selectedStudentId ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="space-y-2">
                {filteredDetail.map(s => (
                  <button key={s.id} onClick={() => setSelectedStudentId(s.id)}
                    className="bg-card border rounded-lg p-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left w-full">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.full_name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{(s.courses as any)?.name || s.custom_course_name || 'Sem curso'}</p>
                    </div>
                  </button>
                ))}
                {filteredDetail.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>
                )}
              </div>
            </>
          ) : (
            // Individual student report
            <div className="space-y-4">
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrintReport}>
                  <Printer className="h-4 w-4 mr-1" /> Imprimir
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              </div>

              <div ref={reportRef} className="space-y-4">
                {selectedStudent && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground">Nome</p><p className="font-medium">{selectedStudent.full_name}</p></div>
                    <div><p className="text-muted-foreground">Curso</p><p className="font-medium">{(selectedStudent.courses as any)?.name || selectedStudent.custom_course_name || '-'}</p></div>
                    <div><p className="text-muted-foreground">Carga Horária</p><p className="font-medium">{selectedStudent.workload}h</p></div>
                    <div><p className="text-muted-foreground">Matrícula</p><p className="font-medium">{selectedStudent.enrollment_date || '-'}</p></div>
                    <div><p className="text-muted-foreground">Primeiro dia</p><p className="font-medium">{(selectedStudent as any).first_class_date || '-'}</p></div>
                    <div><p className="text-muted-foreground">Status</p><p className="font-medium capitalize">{selectedStudent.status?.replace('_', ' ')}</p></div>
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

                {attendanceSummary && (
                  <div className="border rounded-lg p-3">
                    <p className="font-medium mb-2">Frequência</p>
                    <div className="flex gap-4 text-sm mb-2">
                      <span className="text-green-600 font-medium">{attendanceSummary.present} presenças</span>
                      <span className="text-destructive font-medium">{attendanceSummary.absent} faltas</span>
                      <span className="text-muted-foreground">{attendanceSummary.neutral} neutros</span>
                    </div>
                    <p className="text-lg font-bold text-primary">{frequencyPercent}% de frequência</p>
                  </div>
                )}

                {studentAttendance && studentAttendance.length > 0 && (
                  <div className="border rounded-lg p-3">
                    <p className="font-medium mb-2">Detalhes por dia</p>
                    <div className="max-h-60 overflow-auto space-y-1">
                      {studentAttendance.map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                          <span>{a.date}</span>
                          <span className={
                            a.status === 'present' ? 'text-green-600 font-medium' :
                            a.status === 'absent' ? 'text-destructive font-medium' :
                            'text-muted-foreground'
                          }>
                            {a.status === 'present' ? '✔ Presença' : a.status === 'absent' ? '❌ Falta' : '/ Neutro'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
