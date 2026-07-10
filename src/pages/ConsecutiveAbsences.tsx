import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { AlertOctagon, Phone, Printer, FileDown, FileSpreadsheet, X } from 'lucide-react';
// Professor column intentionally removed — not relevant on this tab.
import { useConsecutiveAbsences } from '@/hooks/use-consecutive-absences';
import { useSchool } from '@/contexts/SchoolContext';
import { StudentDetailsDialog } from '@/components/StudentDetailsDialog';
import { AbsenceStreakDialog } from '@/components/AbsenceStreakDialog';
import { openWhatsApp } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const normalize = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function ConsecutiveAbsences() {
  const { school, schoolId } = useSchool();
  const rows = useConsecutiveAbsences(2);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [minStreak, setMinStreak] = useState<string>('2');
  const [openStudent, setOpenStudent] = useState<string | null>(null);

  const handleSaveStreakNote = async (
    row: { studentId: string; firstAbsentInStreakISO: string | null; lastAbsentInStreakISO: string | null },
    values: { isJustified: boolean; note: string }
  ) => {
    if (!schoolId || !row.firstAbsentInStreakISO || !row.lastAbsentInStreakISO) return;
    const { error } = await (supabase as any)
      .from('attendance')
      .update({ is_justified: values.isJustified, absence_note: values.note || null })
      .eq('school_id', schoolId)
      .eq('student_id', row.studentId)
      .eq('status', 'absent')
      .gte('date', row.firstAbsentInStreakISO)
      .lte('date', row.lastAbsentInStreakISO);
    if (error) {
      toast.error('Erro ao salvar observação');
      return;
    }
    toast.success('Observação salva');
    queryClient.invalidateQueries({ queryKey: ['attendance_for_consecutive', schoolId] });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const allCourses = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => r.courses.forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (r.streak < Number(minStreak || 2)) return false;
      if (search && !normalize(r.name).includes(normalize(search))) return false;
      if (courseFilter !== 'all' && !r.courses.includes(courseFilter)) return false;
      return true;
    });
  }, [rows, search, courseFilter, minStreak]);

  const clearFilters = () => {
    setSearch(''); setCourseFilter('all'); setMinStreak('2');
  };

  const exportExcel = () => {
    const data = filtered.map(r => ({
      Aluno: r.name,
      Cursos: r.courses.join(' | '),
      Unidade: school?.name || '',
      Horários: r.schedule,
      'Faltas consecutivas': r.streak,
      'Última presença': r.lastPresentDate || '—',
      'Última falta': r.lastAbsentDate || '—',
      'Frequência (%)': r.attendancePct,
      Telefone: r.phone || '—',
      'Data Início': r.startDate || '—',
      Status: r.status || '—',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faltas Consecutivas');
    XLSX.writeFile(wb, `faltas-consecutivas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Alunos com Faltas Consecutivas', 14, 14);
    doc.setFontSize(10);
    doc.text(`Unidade: ${school?.name || ''}  •  Total: ${filtered.length}`, 14, 21);
    let y = 30;
    doc.setFontSize(9);
    filtered.forEach(r => {
      if (y > 190) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text(`${r.name} — ${r.streak} faltas consecutivas`, 14, y);
      doc.setFont('helvetica', 'normal');
      y += 5;
      doc.text(`Curso(s): ${r.courses.join(' | ')}`, 14, y); y += 5;
      doc.text(`Horários: ${r.schedule}`, 14, y); y += 5;
      doc.text(`Última presença: ${r.lastPresentDate || '—'}  •  Última falta: ${r.lastAbsentDate || '—'}  •  Frequência: ${r.attendancePct}%`, 14, y); y += 5;
      doc.text(`Telefone: ${r.phone || '—'}`, 14, y); y += 7;
    });
    doc.save(`faltas-consecutivas-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 print:hidden">
        <AlertOctagon className="h-6 w-6 text-orange-600" />
        <h1 className="text-2xl font-bold">Alunos com Faltas Consecutivas</h1>
      </div>
      <p className="text-sm text-muted-foreground print:hidden">
        Alunos com 2 ou mais faltas consecutivas registradas na chamada.
      </p>

      <div className="flex flex-wrap gap-2 items-center print:hidden">
        <Input placeholder="Pesquisar por nome..." value={search}
          onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Curso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cursos</SelectItem>
            {allCourses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={minStreak} onValueChange={setMinStreak}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Mín. faltas" /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 5, 6, 8, 10].map(n => (
              <SelectItem key={n} value={String(n)}>{n}+ faltas</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />Limpar
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileDown className="h-4 w-4 mr-1" />PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground print:hidden">
        Exibindo {filtered.length} aluno(s).
      </p>

      {filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">
          Nenhum aluno com faltas consecutivas no momento.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(r => (
            <Card
              key={r.studentId}
              className="border-l-4 border-l-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setOpenStudent(r.studentId)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <Avatar className="h-14 w-14">
                    {r.photo_url && <AvatarImage src={r.photo_url} />}
                    <AvatarFallback>{r.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-tight truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.courses.join(' • ') || '—'}
                    </p>
                  </div>
                  <span className="bg-orange-100 text-orange-700 font-bold rounded-md px-2 py-1 text-sm whitespace-nowrap">
                    {r.streak} faltas
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1">
                  <div><span className="text-muted-foreground">Unidade:</span> {school?.name || '—'}</div>
                  <div><span className="text-muted-foreground">Status:</span> {r.status || '—'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Horários:</span> {r.schedule || '—'}</div>
                  <div><span className="text-muted-foreground">Início:</span> {r.startDate || '—'}</div>
                  <div><span className="text-muted-foreground">Previsão fim:</span> {r.expectedEndDate || '—'}</div>
                  <div><span className="text-muted-foreground">Últ. presença:</span> {r.lastPresentDate || '—'}</div>
                  <div><span className="text-muted-foreground">1ª falta da sequência:</span> {r.firstAbsentInStreakDate || '—'}</div>
                  <div><span className="text-muted-foreground">Últ. falta:</span> {r.lastAbsentDate || '—'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Frequência:</span> {r.attendancePct}% ({r.totalPresent}P / {r.totalAbsent}F)</div>
                </div>

                {(r.streakNote || r.streakJustified) && (
                  <p className="text-xs pt-1 border-t">
                    <span className={r.streakJustified ? 'text-green-700 font-medium' : 'text-muted-foreground font-medium'}>
                      {r.streakJustified ? '✔ Mensagem enviada. ' : ''}
                    </span>
                    {r.streakNote && (
                      <span className="text-muted-foreground">Obs: {r.streakNote}</span>
                    )}
                  </p>
                )}

                {r.observations.length > 0 && (
                  <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t">
                    <span className="font-medium">Obs. gerais:</span> {r.observations[0]}
                  </p>
                )}

                <div className="flex justify-end items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  <AbsenceJustificationPopover
                    isJustified={r.streakJustified}
                    note={r.streakNote}
                    checkboxLabel="Mensagem enviada"
                    triggerTitle="Registrar mensagem enviada e observação da sequência"
                    onSave={(v) => handleSaveStreakNote(r, v)}
                  />
                  {r.phone ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700"
                      onClick={(e) => { e.stopPropagation(); openWhatsApp(r.phone); }}
                    >
                      <Phone className="h-3.5 w-3.5 mr-1" />{r.phone}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem telefone</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StudentDetailsDialog
        open={!!openStudent}
        onOpenChange={(o) => !o && setOpenStudent(null)}
        studentId={openStudent}
      />
    </div>
  );
}
