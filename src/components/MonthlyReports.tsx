import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Search, User, Printer, Download, FileSpreadsheet } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type DetailView = 'active' | 'finalized' | 'dropouts' | 'presencas' | 'faltas' | null;

export function MonthlyReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const { data: stats } = useQuery({
    queryKey: ['monthly_stats_sc', month, year],
    queryFn: async () => {
      const { data: active } = await (supabase as any).from('student_courses')
        .select('id')
        .eq('status', 'em_andamento');

      const { data: finalized } = await (supabase as any).from('student_courses')
        .select('id, created_at')
        .eq('status', 'finalizado');

      const { data: dropouts } = await (supabase as any).from('student_courses')
        .select('id, created_at')
        .eq('status', 'desistiu');

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

  const { data: detailStudents } = useQuery({
    queryKey: ['monthly_detail_sc', detailView, month, year],
    enabled: detailView === 'active' || detailView === 'finalized' || detailView === 'dropouts',
    queryFn: async () => {
      let statusFilter = 'em_andamento';
      if (detailView === 'finalized') statusFilter = 'finalizado';
      if (detailView === 'dropouts') statusFilter = 'desistiu';

      const { data } = await (supabase as any).from('student_courses')
        .select('*, students(id, full_name, birth_date, cpf, street, house_number, enrollment_date, first_class_date, guardian_name, guardian_phone), courses(name, workload)')
        .eq('status', statusFilter);

      return (data ?? []).map((sc: any) => ({
        id: sc.students?.id ?? sc.id,
        full_name: sc.students?.full_name,
        birth_date: sc.students?.birth_date,
        cpf: sc.students?.cpf,
        street: sc.students?.street,
        house_number: sc.students?.house_number,
        enrollment_date: sc.enrollment_date,
        first_class_date: sc.first_class_date,
        guardian_name: sc.students?.guardian_name,
        guardian_phone: sc.students?.guardian_phone,
        courseName: sc.courses?.name || sc.custom_course_name || 'Sem curso',
        workload: sc.workload,
        status: sc.status,
      }));
    },
  });

  // Aggregated attendance per student for the selected month (presences/absences)
  const { data: attendanceByStudent } = useQuery({
    queryKey: ['monthly_attendance_by_student', month, year],
    enabled: detailView === 'presencas' || detailView === 'faltas',
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status, students(full_name)')
        .gte('date', startDate)
        .lte('date', endDate)
        .limit(10000);
      const map = new Map<string, { id: string; full_name: string; presencas: number; faltas: number }>();
      (data ?? []).forEach((r: any) => {
        const cur = map.get(r.student_id) || {
          id: r.student_id,
          full_name: r.students?.full_name || 'Sem nome',
          presencas: 0,
          faltas: 0,
        };
        if (r.status === 'present') cur.presencas += 1;
        else if (r.status === 'absent') cur.faltas += 1;
        map.set(r.student_id, cur);
      });
      return Array.from(map.values());
    },
  });

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

  const selectedStudent = detailStudents?.find((s: any) => s.id === selectedStudentId);

  const filteredDetail = detailStudents?.filter((s: any) =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const isAttendanceList = detailView === 'presencas' || detailView === 'faltas';
  const attendanceList = (attendanceByStudent ?? [])
    .filter(s => detailView === 'presencas' ? s.presencas > 0 : s.faltas > 0)
    .filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      detailView === 'presencas' ? b.presencas - a.presencas : b.faltas - a.faltas
    );

  const detailLabels: Record<string, string> = {
    active: 'Alunos Ativos',
    finalized: 'Alunos Finalizados',
    dropouts: 'Alunos Desistentes',
    presencas: 'Presenças do Mês',
    faltas: 'Faltas do Mês',
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

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

  // Export current list view (students or attendance)
  const getExportRows = () => {
    if (isAttendanceList) {
      return attendanceList.map(s => ({
        Nome: s.full_name,
        [detailView === 'presencas' ? 'Presenças' : 'Faltas']:
          detailView === 'presencas' ? s.presencas : s.faltas,
      }));
    }
    return filteredDetail.map((s: any) => ({
      Nome: s.full_name || '',
      Curso: s.courseName,
      'Carga Horária': s.workload,
      Matrícula: s.enrollment_date || '',
      'Primeiro dia': s.first_class_date || '',
      Status: s.status,
    }));
  };

  const exportFileName = () => {
    const label = detailView ? detailLabels[detailView].replace(/\s/g, '_') : 'relatorio';
    return `${label}_${MONTHS[month]}_${year}`;
  };

  const handleExportListExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `${exportFileName()}.xlsx`);
  };

  const handleExportListPDF = async () => {
    if (!listRef.current) return;
    const canvas = await html2canvas(listRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`${exportFileName()}.pdf`);
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
        <button onClick={() => { setDetailView('presencas'); setSearch(''); }} className="bg-card border rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <p className="text-sm text-muted-foreground">Presenças</p>
          <p className="text-2xl font-bold text-green-600">{stats?.totalPresencas ?? 0}</p>
        </button>
        <button onClick={() => { setDetailView('faltas'); setSearch(''); }} className="bg-card border rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <p className="text-sm text-muted-foreground">Faltas</p>
          <p className="text-2xl font-bold text-destructive">{stats?.totalFaltas ?? 0}</p>
        </button>
      </div>

      <Dialog open={!!detailView} onOpenChange={() => { setDetailView(null); setSelectedStudentId(null); }}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-auto">
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
              <div className="flex flex-wrap gap-2 mb-3 print:hidden">
                <Button variant="outline" size="sm" onClick={handleExportListExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportListPDF}>
                  <Download className="h-4 w-4 mr-1" /> Exportar PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintReport}>
                  <Printer className="h-4 w-4 mr-1" /> Imprimir
                </Button>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>

              <div ref={listRef} className="space-y-2 bg-background p-2">
                <h3 className="text-sm font-semibold mb-2 hidden print:block">
                  {detailView ? `${detailLabels[detailView]} - ${MONTHS[month]} ${year}` : ''}
                </h3>

                {isAttendanceList ? (
                  <>
                    {attendanceList.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudentId(s.id)}
                        className="bg-card border rounded-lg p-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
                      >
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{s.full_name}</p>
                        </div>
                        <span className={`font-bold text-lg ${detailView === 'presencas' ? 'text-green-600' : 'text-destructive'}`}>
                          {detailView === 'presencas' ? s.presencas : s.faltas}
                        </span>
                      </button>
                    ))}
                    {attendanceList.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>
                    )}
                  </>
                ) : (
                  <>
                    {filteredDetail.map((s: any) => (
                      <button key={s.id + s.courseName} onClick={() => setSelectedStudentId(s.id)}
                        className="bg-card border rounded-lg p-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left w-full">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{s.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{s.courseName}</p>
                        </div>
                      </button>
                    ))}
                    {filteredDetail.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
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
                    <div><p className="text-muted-foreground">Curso</p><p className="font-medium">{selectedStudent.courseName}</p></div>
                    <div><p className="text-muted-foreground">Carga Horária</p><p className="font-medium">{selectedStudent.workload}h</p></div>
                    <div><p className="text-muted-foreground">Matrícula</p><p className="font-medium">{selectedStudent.enrollment_date || '-'}</p></div>
                    <div><p className="text-muted-foreground">Primeiro dia</p><p className="font-medium">{selectedStudent.first_class_date || '-'}</p></div>
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
