import { useState, useEffect, useMemo } from 'react';
import { useStudents, useCourses, useTimeSlots, useCreateStudent, useUpdateStudent, useDeleteStudent, useCompletions } from '@/hooks/use-supabase-data';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { Plus, Pencil, Trash2, Search, History } from 'lucide-react';
import { toast } from 'sonner';

interface StudentForm {
  full_name: string; street: string; house_number: string; birth_date: string;
  cpf: string; enrollment_date: string; course_id: string; custom_course_name: string;
  guardian_name: string; guardian_phone: string;
  daySchedules: Record<string, string[]>;
  show_guardian: boolean; workload: number;
  status: string;
}

const emptyForm: StudentForm = {
  full_name: '', street: '', house_number: '', birth_date: '',
  cpf: '', enrollment_date: '', course_id: '', custom_course_name: '',
  guardian_name: '', guardian_phone: '',
  daySchedules: {},
  show_guardian: false, workload: 48,
  status: 'em_andamento',
};

const WEEKDAY_TIMES = [
  { start: '08:00', end: '09:00', label: '08:00 às 09:00' },
  { start: '09:00', end: '10:00', label: '09:00 às 10:00' },
  { start: '10:00', end: '11:00', label: '10:00 às 11:00' },
  { start: '13:30', end: '14:30', label: '13:30 às 14:30' },
  { start: '14:30', end: '15:30', label: '14:30 às 15:30' },
  { start: '15:30', end: '16:30', label: '15:30 às 16:30' },
  { start: '16:30', end: '17:30', label: '16:30 às 17:30' },
];

const SATURDAY_TIMES = [
  { start: '08:00', end: '10:00', label: '08:00 às 10:00' },
  { start: '10:00', end: '12:00', label: '10:00 às 12:00' },
];

const STATUS_OPTIONS = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'desistiu', label: 'Desistiu' },
];

function isMinor(birthDate: string): boolean {
  if (!birthDate) return false;
  const parts = birthDate.split('/');
  let date: Date | null = null;
  if (parts.length === 3) {
    date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  } else {
    date = new Date(birthDate);
  }
  if (isNaN(date.getTime())) return false;
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return age < 18;
}

function timeKey(start: string, end: string) {
  return `${start}-${end}`;
}

export default function Students() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);

  const { data: students } = useStudents();
  const { data: courses } = useCourses();
  const { data: timeSlots } = useTimeSlots();
  const { data: completions } = useCompletions();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();

  const slotLookup = useMemo(() => {
    const map: Record<string, string> = {};
    timeSlots?.forEach(ts => {
      map[`${ts.day_of_week}|${timeKey(ts.start_time, ts.end_time)}`] = ts.id;
    });
    return map;
  }, [timeSlots]);

  const reverseSlotLookup = useMemo(() => {
    const map: Record<string, { day: string; time: string }> = {};
    timeSlots?.forEach(ts => {
      map[ts.id] = { day: ts.day_of_week, time: timeKey(ts.start_time, ts.end_time) };
    });
    return map;
  }, [timeSlots]);

  const { data: editSchedules } = useQuery({
    queryKey: ['edit_schedules', editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data } = await supabase.from('student_schedules').select('time_slot_id').eq('student_id', editingId!);
      return data?.map(s => s.time_slot_id) ?? [];
    },
  });

  useEffect(() => {
    if (editingId && editSchedules && Object.keys(reverseSlotLookup).length > 0) {
      const daySchedules: Record<string, string[]> = {};
      editSchedules.forEach(tsId => {
        const info = reverseSlotLookup[tsId];
        if (info) {
          if (!daySchedules[info.day]) daySchedules[info.day] = [];
          if (!daySchedules[info.day].includes(info.time)) {
            daySchedules[info.day].push(info.time);
          }
        }
      });
      setForm(f => ({ ...f, daySchedules }));
    }
  }, [editingId, editSchedules, reverseSlotLookup]);

  const filtered = students?.filter(s =>
    !search || (s.full_name?.toLowerCase().includes(search.toLowerCase()))
  ) ?? [];

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (student: any) => {
    setEditingId(student.id);
    setForm({
      full_name: student.full_name ?? '',
      street: student.street ?? '',
      house_number: student.house_number ?? '',
      birth_date: student.birth_date ?? '',
      cpf: student.cpf ?? '',
      enrollment_date: student.enrollment_date ?? '',
      course_id: student.course_id ?? '',
      custom_course_name: student.custom_course_name ?? '',
      guardian_name: student.guardian_name ?? '',
      guardian_phone: student.guardian_phone ?? '',
      daySchedules: {},
      show_guardian: !!student.guardian_name || isMinor(student.birth_date ?? ''),
      workload: student.workload ?? 48,
      status: (student as any).status || 'em_andamento',
    });
    setDialogOpen(true);
  };

  const computeScheduleIds = (daySchedules: Record<string, string[]>): string[] => {
    const ids: string[] = [];
    for (const [day, times] of Object.entries(daySchedules)) {
      for (const time of times) {
        const id = slotLookup[`${day}|${time}`];
        if (id) ids.push(id);
      }
    }
    return ids;
  };

  const handleSave = async () => {
    const schedules = computeScheduleIds(form.daySchedules);
    const shouldDeactivate = form.status === 'finalizado' || form.status === 'desistiu';
    const data: any = {
      full_name: form.full_name || null,
      street: form.street || null,
      house_number: form.house_number || null,
      birth_date: form.birth_date || null,
      cpf: form.cpf || null,
      enrollment_date: form.enrollment_date || null,
      course_id: form.course_id || null,
      custom_course_name: form.custom_course_name || null,
      guardian_name: form.show_guardian ? form.guardian_name || null : null,
      guardian_phone: form.show_guardian ? form.guardian_phone || null : null,
      schedules: shouldDeactivate ? [] : schedules,
      workload: form.workload,
      status: form.status,
      is_active: !shouldDeactivate,
    };

    if (editingId) {
      updateStudent.mutate({ id: editingId, ...data }, {
        onSuccess: () => { toast.success('Aluno atualizado!'); setDialogOpen(false); },
        onError: () => toast.error('Erro ao atualizar aluno'),
      });
    } else {
      createStudent.mutate(data, {
        onSuccess: () => { toast.success('Aluno cadastrado!'); setDialogOpen(false); },
        onError: () => toast.error('Erro ao cadastrar aluno'),
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este aluno?')) {
      deleteStudent.mutate(id, {
        onSuccess: () => toast.success('Aluno excluído!'),
      });
    }
  };

  const toggleDayTime = (day: string, time: string) => {
    setForm(f => {
      const current = f.daySchedules[day] || [];
      const updated = current.includes(time)
        ? current.filter(t => t !== time)
        : [...current, time];
      const newDaySchedules = { ...f.daySchedules };
      if (updated.length === 0) {
        delete newDaySchedules[day];
      } else {
        newDaySchedules[day] = updated;
      }
      return { ...f, daySchedules: newDaySchedules };
    });
  };

  const showGuardian = form.show_guardian || isMinor(form.birth_date);

  // Course history for a student
  const studentCompletions = completions?.filter(c => c.student_id === historyStudentId) ?? [];
  const historyStudent = students?.find(s => s.id === historyStudentId);

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(o => o.value === status)?.label || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finalizado': return 'text-success';
      case 'desistiu': return 'text-destructive';
      default: return 'text-primary';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Alunos</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Aluno</Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-3">
        {filtered.map(s => (
          <div key={s.id} className="bg-card border rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{s.full_name || 'Sem nome'}</p>
                <span className={`text-xs font-medium ${getStatusColor((s as any).status || 'em_andamento')}`}>
                  ({getStatusLabel((s as any).status || 'em_andamento')})
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{(s.courses as any)?.name || s.custom_course_name || 'Sem curso'}</p>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" onClick={() => setHistoryStudentId(s.id)} title="Histórico de cursos">
                <History className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>}
      </div>

      {/* Course History Dialog */}
      <Dialog open={!!historyStudentId} onOpenChange={() => setHistoryStudentId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Cursos - {historyStudent?.full_name || 'Aluno'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {historyStudent && (
              <div className="border rounded-lg p-3 bg-primary/5">
                <p className="text-sm font-medium">Curso Atual</p>
                <p className="font-semibold">{(historyStudent.courses as any)?.name || historyStudent.custom_course_name || 'Sem curso'}</p>
                <p className="text-xs text-muted-foreground">Carga horária: {historyStudent.workload}h</p>
              </div>
            )}
            {studentCompletions.length > 0 && (
              <>
                <p className="text-sm font-medium text-muted-foreground">Cursos Anteriores</p>
                {studentCompletions.map(c => (
                  <div key={c.id} className="border rounded-lg p-3">
                    <p className="font-medium">{c.course_name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.start_date ?? '-'} → {c.end_date}
                    </p>
                  </div>
                ))}
              </>
            )}
            {studentCompletions.length === 0 && (
              <p className="text-muted-foreground text-sm">Nenhum curso anterior registrado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Aluno' : 'Novo Aluno'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Nome completo</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} /></div>
              <div><Label>Rua</Label><Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
              <div><Label>Número</Label><Input value={form.house_number} onChange={e => setForm(f => ({ ...f, house_number: e.target.value }))} /></div>
              <div><Label>Data de nascimento</Label><Input placeholder="dd/mm/aaaa" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} /></div>
              <div><Label>Data da matrícula</Label><Input placeholder="dd/mm/aaaa" value={form.enrollment_date} onChange={e => setForm(f => ({ ...f, enrollment_date: e.target.value }))} /></div>
            </div>

            {showGuardian && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold mb-3">Responsável</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>Nome do responsável</Label><Input value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))} /></div>
                  <div><Label>Telefone do responsável</Label><Input value={form.guardian_phone} onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))} /></div>
                </div>
              </div>
            )}
            {!isMinor(form.birth_date) && !form.show_guardian && (
              <Button variant="outline" size="sm" className="w-fit" onClick={() => setForm(f => ({ ...f, show_guardian: true }))}>
                + Adicionar responsável
              </Button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Curso</Label>
                <Select value={form.course_id} onValueChange={v => setForm(f => ({ ...f, course_id: v === 'custom' ? '' : v, custom_course_name: v === 'custom' ? f.custom_course_name : '' }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar curso" /></SelectTrigger>
                  <SelectContent>
                    {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    <SelectItem value="custom">Outro (digitar)</SelectItem>
                  </SelectContent>
                </Select>
                {!form.course_id && form.custom_course_name !== undefined && (
                  <Input className="mt-2" placeholder="Nome do curso" value={form.custom_course_name} onChange={e => setForm(f => ({ ...f, custom_course_name: e.target.value }))} />
                )}
              </div>
              <div>
                <Label>Carga Horária (horas)</Label>
                <Input type="number" min={1} value={form.workload} onChange={e => setForm(f => ({ ...f, workload: parseInt(e.target.value) || 48 }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Schedule - Organized by Day */}
            <div>
              <Label className="mb-2 block font-semibold">Dias e Horários</Label>
              <div className="space-y-3">
                {DAYS_OF_WEEK.map(day => {
                  const dayTimes = form.daySchedules[day] || [];
                  const times = day === 'Sábado' ? SATURDAY_TIMES : WEEKDAY_TIMES;
                  return (
                    <div key={day} className="border rounded-lg p-3">
                      <span className="font-medium text-sm block mb-2">{day}</span>
                      <div className="flex flex-wrap gap-2 ml-2">
                        {times.map(t => {
                          const tk = timeKey(t.start, t.end);
                          return (
                            <label key={tk} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <Checkbox
                                checked={dayTimes.includes(tk)}
                                onCheckedChange={() => toggleDayTime(day, tk)}
                              />
                              {t.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {Object.keys(form.daySchedules).length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {computeScheduleIds(form.daySchedules).length} combinações de dia/horário serão registradas.
                </p>
              )}
            </div>

            <Button onClick={handleSave} disabled={createStudent.isPending || updateStudent.isPending}>
              {editingId ? 'Salvar Alterações' : 'Cadastrar Aluno'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
