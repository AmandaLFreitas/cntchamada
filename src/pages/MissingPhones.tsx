import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStudents, useStudentSchedules } from '@/hooks/use-supabase-data';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PhoneOff, Printer, FileDown, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const AMANDA_COURSES = [
  'programação kids - scratch',
  'lógica de programação - java',
  'programação - html/css',
];
const normalize = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const teacherFor = (course: string): 'Amanda' | 'Vanderlei' => {
  const n = normalize(course);
  return AMANDA_COURSES.some(c => normalize(c) === n || n.includes(normalize(c))) ? 'Amanda' : 'Vanderlei';
};

const formatPhoneMask = (raw: string): string => {
  const d = (raw || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const isPhoneValid = (p: string | null | undefined) => {
  if (!p) return false;
  const d = p.replace(/\D/g, '');
  return d.length === 10 || d.length === 11;
};

const fmtDate = (v: string | null | undefined) => {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return v;
};

const DAY_ORDER: Record<string, number> = {
  segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};
const DAY_LABEL: Record<string, string> = {
  segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta',
  quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado',
};

interface EditState {
  studentId: string;
  name: string;
  phone: string;
}

export default function MissingPhones() {
  const { school } = useSchool();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: students } = useStudents(true);
  const { data: schedules } = useStudentSchedules();

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [editing, setEditing] = useState<EditState | null>(null);

  const schedByStudent = useMemo(() => {
    const m: Record<string, any[]> = {};
    (schedules ?? []).forEach((sch: any) => {
      if (!m[sch.student_id]) m[sch.student_id] = [];
      m[sch.student_id].push(sch);
    });
    return m;
  }, [schedules]);

  const rows = useMemo(() => {
    if (!students) return [];
    return (students as any[])
      .filter(s => !isPhoneValid(s.guardian_phone))
      .map(s => {
        const activeCourses = (s.student_courses ?? []).filter((sc: any) => sc.is_active);
        const courses = activeCourses.map((sc: any) => sc.courses?.name || sc.custom_course_name || 'N/A');
        const slots = (schedByStudent[s.id] ?? []).map((sch: any) => sch.time_slots).filter(Boolean);
        const schedule = slots
          .map((ts: any) => ({
            label: DAY_LABEL[normalize(ts.day_of_week)] || ts.day_of_week,
            order: DAY_ORDER[normalize(ts.day_of_week)] ?? 99,
            text: `${DAY_LABEL[normalize(ts.day_of_week)] || ts.day_of_week} ${ts.start_time?.slice(0, 5)}-${ts.end_time?.slice(0, 5)}`,
          }))
          .sort((a: any, b: any) => a.order - b.order)
          .map((x: any) => x.text)
          .join(', ');
        const enrollment = activeCourses[0]?.enrollment_date || null;
        const firstClass = activeCourses[0]?.first_class_date || null;
        return {
          id: s.id,
          name: s.full_name || 'Sem nome',
          photo_url: s.photo_url,
          phone: s.guardian_phone || '',
          courses,
          schedule,
          enrollment_date: enrollment,
          first_class_date: firstClass,
        };
      })
      .filter(r => {
        if (search && !normalize(r.name).includes(normalize(search))) return false;
        if (courseFilter !== 'all' && !r.courses.includes(courseFilter)) return false;
        if (teacherFilter !== 'all') {
          const teachers = new Set(r.courses.map(teacherFor));
          if (!teachers.has(teacherFilter as 'Amanda' | 'Vanderlei')) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, schedByStudent, search, courseFilter, teacherFilter]);

  const allCourses = useMemo(() => {
    const set = new Set<string>();
    (students ?? []).forEach((s: any) => {
      (s.student_courses ?? []).forEach((sc: any) => {
        if (sc.is_active) set.add(sc.courses?.name || sc.custom_course_name || 'N/A');
      });
    });
    return Array.from(set).sort();
  }, [students]);

  const savePhone = useMutation({
    mutationFn: async ({ studentId, phone }: { studentId: string; phone: string }) => {
      const digits = phone.replace(/\D/g, '');
      const { error } = await (supabase as any)
        .from('students')
        .update({ guardian_phone: digits ? formatPhoneMask(digits) : null })
        .eq('id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student_details'] });
      qc.invalidateQueries({ queryKey: ['slot_students'] });
      qc.invalidateQueries({ queryKey: ['rescue'] });
      toast.success('Telefone atualizado em todo o sistema.');
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const clearFilters = () => {
    setSearch(''); setCourseFilter('all'); setTeacherFilter('all');
  };

  const exportExcel = () => {
    const data = rows.map(r => ({
      Aluno: r.name,
      Cursos: r.courses.join(' | '),
      Professor: Array.from(new Set(r.courses.map(teacherFor))).join(' | '),
      Unidade: school?.name || '',
      Horários: r.schedule,
      'Data Matrícula': fmtDate(r.enrollment_date),
      'Data Início': fmtDate(r.first_class_date),
      Telefone: r.phone || '—',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sem Telefone');
    XLSX.writeFile(wb, `alunos-sem-telefone-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Alunos sem Telefone', 14, 14);
    doc.setFontSize(10);
    doc.text(`Unidade: ${school?.name || ''}  •  Total: ${rows.length}`, 14, 21);
    let y = 30;
    doc.setFontSize(9);
    rows.forEach(r => {
      if (y > 195) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text(r.name, 14, y);
      doc.setFont('helvetica', 'normal'); y += 5;
      doc.text(`Curso(s): ${r.courses.join(' | ')}`, 14, y); y += 5;
      doc.text(`Horários: ${r.schedule || '—'}`, 14, y); y += 5;
      doc.text(`Matrícula: ${fmtDate(r.enrollment_date)}  •  Início: ${fmtDate(r.first_class_date)}`, 14, y); y += 7;
    });
    doc.save(`alunos-sem-telefone-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <PhoneOff className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          Acesso restrito a administradores (dados de contato são protegidos).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 print:hidden">
        <PhoneOff className="h-6 w-6 text-red-600" />
        <h1 className="text-2xl font-bold">Alunos sem Telefone</h1>
      </div>
      <p className="text-sm text-muted-foreground print:hidden">
        Alunos sem telefone cadastrado ou com número inválido. Clique no nome para editar.
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
        <Select value={teacherFilter} onValueChange={setTeacherFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Professor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os professores</SelectItem>
            <SelectItem value="Vanderlei">Vanderlei</SelectItem>
            <SelectItem value="Amanda">Amanda</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />Limpar
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
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
        Exibindo {rows.length} aluno(s).
      </p>

      {rows.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">
          Todos os alunos possuem telefone cadastrado.
        </p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Cursos</TableHead>
                <TableHead>Professor</TableHead>
                <TableHead>Horários</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Telefone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <button
                      className="flex items-center gap-2 hover:underline text-left"
                      onClick={() => setEditing({ studentId: r.id, name: r.name, phone: formatPhoneMask(r.phone) })}
                    >
                      <Avatar className="h-8 w-8">
                        {r.photo_url && <AvatarImage src={r.photo_url} />}
                        <AvatarFallback>{r.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{r.name}</span>
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">{r.courses.join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {Array.from(new Set(r.courses.map(teacherFor))).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-xs">{r.schedule || '—'}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.enrollment_date)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.first_class_date)}</TableCell>
                  <TableCell>
                    {r.phone
                      ? <span className="text-orange-600 text-xs">Inválido: {r.phone}</span>
                      : <span className="text-red-600 text-xs">Sem telefone</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar telefone</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Aluno</Label>
                <Input value={editing.name} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="(99) 99999-9999"
                  value={editing.phone}
                  onChange={e => setEditing({ ...editing, phone: formatPhoneMask(e.target.value) })}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: (99) 99999-9999. Deixe vazio para remover.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && savePhone.mutate({ studentId: editing.studentId, phone: editing.phone })}
              disabled={savePhone.isPending}
            >
              {savePhone.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
