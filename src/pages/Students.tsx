import { useState, useEffect, useMemo, useRef } from 'react';
import { useStudents, useCourses, useTimeSlots, useCreateStudent, useUpdateStudent, useDeleteStudent, useCompletions } from '@/hooks/use-supabase-data';
import { supabase } from '@/integrations/supabase/client';
import { DateInput } from '@/components/DateInput';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { Plus, Pencil, Trash2, Search, History, BookOpen, BarChart3, Camera, MessageSquare } from 'lucide-react';
import { StudentObservationsDialog } from '@/components/StudentObservationsDialog';
import { StudentFrequencyDialog } from '@/components/StudentFrequencyDialog';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PhotoLightbox } from '@/components/PhotoLightbox';

interface StudentForm {
  full_name: string; street: string; house_number: string; birth_date: string;
  cpf: string; guardian_name: string; guardian_phone: string;
  photo_url: string;
  material_sent: boolean;
  // Course data
  course_id: string; custom_course_name: string;
  enrollment_date: string; first_class_date: string;
  workload: number; status: string; payment_method: string;
  // Schedules
  daySchedules: Record<string, string[]>;
  show_guardian: boolean;
  customScheduleMode: boolean;
}

const PAYMENT_OPTIONS = [
  { value: 'a_vista', label: 'À vista' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'boleto', label: 'Boleto' },
];

const emptyForm: StudentForm = {
  full_name: '', street: '', house_number: '', birth_date: '',
  cpf: '', guardian_name: '', guardian_phone: '',
  photo_url: '',
  material_sent: false,
  course_id: '', custom_course_name: '',
  enrollment_date: '', first_class_date: '',
  workload: 48, status: 'em_andamento', payment_method: '',
  daySchedules: {},
  show_guardian: false,
  customScheduleMode: false,
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
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null); // student_course id
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [addCourseStudentId, setAddCourseStudentId] = useState<string | null>(null);
  const [frequencyStudentId, setFrequencyStudentId] = useState<string | null>(null);
  const [observationsStudentId, setObservationsStudentId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: students } = useStudents(false); // all students
  const { data: courses } = useCourses();
  const { data: timeSlots } = useTimeSlots();
  const { data: completions } = useCompletions();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const qc = useQueryClient();

  // Fetch which students have observations
  const studentIds = students?.map((s: any) => s.id) ?? [];
  const { data: studentsWithObs } = useQuery({
    queryKey: ['students_with_obs', studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_observations')
        .select('student_id')
        .in('student_id', studentIds);
      const set = new Set<string>();
      data?.forEach(r => set.add(r.student_id));
      return set;
    },
  });

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

  // Load schedules when editing a student_course
  const { data: editSchedules } = useQuery({
    queryKey: ['edit_schedules_sc', editingCourseId],
    enabled: !!editingCourseId,
    queryFn: async () => {
      const { data } = await supabase.from('student_schedules')
        .select('time_slot_id')
        .eq('student_course_id', editingCourseId!);
      return data?.map(s => s.time_slot_id) ?? [];
    },
  });

  useEffect(() => {
    if (editingCourseId && editSchedules && Object.keys(reverseSlotLookup).length > 0) {
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

      // Auto-detect if custom schedule mode is needed
      // Check if paired days have matching times (Segunda↔Quarta, Terça↔Quinta)
      const pairs: [string, string][] = [['Segunda', 'Quarta'], ['Terça', 'Quinta']];
      let isCustom = false;
      for (const [a, b] of pairs) {
        const timesA = (daySchedules[a] || []).sort().join(',');
        const timesB = (daySchedules[b] || []).sort().join(',');
        if (timesA !== timesB) {
          isCustom = true;
          break;
        }
      }
      // If any non-paired day has schedules (e.g., only Sábado without matching pair structure)
      const hasSabado = (daySchedules['Sábado'] || []).length > 0;
      const hasWeekday = Object.keys(daySchedules).some(d => d !== 'Sábado');
      // Check if only one day of a pair has schedules
      for (const [a, b] of pairs) {
        const hasA = (daySchedules[a] || []).length > 0;
        const hasB = (daySchedules[b] || []).length > 0;
        if (hasA !== hasB) {
          isCustom = true;
          break;
        }
      }

      setForm(f => ({ ...f, daySchedules, customScheduleMode: isCustom }));
    }
  }, [editingCourseId, editSchedules, reverseSlotLookup]);

  // Filter students - show each student once
  const filtered = useMemo(() => {
    const list = students ?? [];
    if (!search) return list;
    return list.filter((s: any) =>
      s.full_name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [students, search]);

  const openNew = () => {
    setEditingStudentId(null);
    setEditingCourseId(null);
    setAddCourseStudentId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openAddCourse = (studentId: string, student: any) => {
    setEditingStudentId(null);
    setEditingCourseId(null);
    setAddCourseStudentId(studentId);
    setForm({
      ...emptyForm,
      full_name: student.full_name ?? '',
      street: student.street ?? '',
      house_number: student.house_number ?? '',
      birth_date: student.birth_date ?? '',
      cpf: student.cpf ?? '',
      guardian_name: student.guardian_name ?? '',
      guardian_phone: student.guardian_phone ?? '',
      show_guardian: !!student.guardian_name || isMinor(student.birth_date ?? ''),
    });
    setDialogOpen(true);
  };

  const openEditCourse = (student: any, sc: any) => {
    setEditingStudentId(student.id);
    setEditingCourseId(sc.id);
    setAddCourseStudentId(null);
    setForm({
      full_name: student.full_name ?? '',
      street: student.street ?? '',
      house_number: student.house_number ?? '',
      birth_date: student.birth_date ?? '',
      cpf: student.cpf ?? '',
      guardian_name: student.guardian_name ?? '',
      guardian_phone: student.guardian_phone ?? '',
      photo_url: student.photo_url ?? '',
      material_sent: (student as any).material_sent ?? false,
      course_id: sc.course_id ?? '',
      custom_course_name: sc.custom_course_name ?? '',
      enrollment_date: sc.enrollment_date ?? '',
      first_class_date: sc.first_class_date ?? '',
      workload: sc.workload ?? 48,
      status: sc.status || 'em_andamento',
      payment_method: sc.payment_method ?? '',
      daySchedules: {}, // Will be populated by useEffect from editSchedules
      show_guardian: !!student.guardian_name || isMinor(student.birth_date ?? ''),
      customScheduleMode: false, // Will be auto-detected by useEffect
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

  const checkDuplicate = async (name: string): Promise<{ id: string; student: any } | null> => {
    if (!name.trim()) return null;
    const { data } = await supabase
      .from('students')
      .select('*')
      .ilike('full_name', name.trim());
    if (data && data.length > 0) return { id: data[0].id, student: data[0] };
    return null;
  };

  const handleSave = async () => {
    const schedules = computeScheduleIds(form.daySchedules);
    const shouldDeactivate = form.status === 'finalizado' || form.status === 'desistiu';

    const personalData: any = {
      full_name: form.full_name || null,
      birth_date: form.birth_date || null,
      guardian_name: form.show_guardian ? form.guardian_name || null : null,
      guardian_phone: form.show_guardian ? form.guardian_phone || null : null,
      photo_url: form.photo_url || null,
      material_sent: form.material_sent,
    };
    if (isAdmin) {
      personalData.street = form.street || null;
      personalData.house_number = form.house_number || null;
      personalData.cpf = form.cpf || null;
    }

    // Adding a new course to existing student
    if (addCourseStudentId) {
      createStudent.mutate({
        ...personalData,
        existingStudentId: addCourseStudentId,
        course_id: form.course_id || null,
        custom_course_name: form.custom_course_name || null,
        enrollment_date: form.enrollment_date || null,
        first_class_date: form.first_class_date || null,
        workload: form.workload,
        status: form.status,
        payment_method: isAdmin ? form.payment_method || null : undefined,
        schedules: shouldDeactivate ? [] : schedules,
      }, {
        onSuccess: () => { toast.success('Curso adicionado ao aluno!'); setDialogOpen(false); },
        onError: () => toast.error('Erro ao adicionar curso'),
      });
      return;
    }

    // Editing existing student + course
    if (editingStudentId && editingCourseId) {
      updateStudent.mutate({
        id: editingStudentId,
        studentCourseId: editingCourseId,
        ...personalData,
        course_id: form.course_id || null,
        custom_course_name: form.custom_course_name || null,
        enrollment_date: form.enrollment_date || null,
        first_class_date: form.first_class_date || null,
        workload: form.workload,
        status: form.status,
        payment_method: isAdmin ? form.payment_method || null : undefined,
        is_active: !shouldDeactivate,
        schedules: shouldDeactivate ? [] : schedules,
      }, {
        onSuccess: () => { toast.success('Aluno atualizado!'); setDialogOpen(false); },
        onError: () => toast.error('Erro ao atualizar aluno'),
      });
      return;
    }

    // Creating new student - check for duplicate
    if (form.full_name.trim()) {
      const existing = await checkDuplicate(form.full_name);
      if (existing) {
        const confirmed = confirm(
          `Já existe um aluno com o nome "${form.full_name}". Deseja adicionar um novo curso a este aluno?`
        );
        if (confirmed) {
          createStudent.mutate({
            ...personalData,
            existingStudentId: existing.id,
            course_id: form.course_id || null,
            custom_course_name: form.custom_course_name || null,
            enrollment_date: form.enrollment_date || null,
            first_class_date: form.first_class_date || null,
            workload: form.workload,
            status: form.status,
            payment_method: isAdmin ? form.payment_method || null : undefined,
            schedules: shouldDeactivate ? [] : schedules,
          }, {
            onSuccess: () => { toast.success('Curso adicionado ao aluno existente!'); setDialogOpen(false); },
            onError: () => toast.error('Erro ao adicionar curso'),
          });
          return;
        } else {
          return;
        }
      }
    }

    // Create new student + course
    createStudent.mutate({
      ...personalData,
      course_id: form.course_id || null,
      custom_course_name: form.custom_course_name || null,
      enrollment_date: form.enrollment_date || null,
      first_class_date: form.first_class_date || null,
      workload: form.workload,
      status: form.status,
      payment_method: isAdmin ? form.payment_method || null : undefined,
      schedules: shouldDeactivate ? [] : schedules,
    }, {
      onSuccess: () => { toast.success('Aluno cadastrado!'); setDialogOpen(false); },
      onError: () => toast.error('Erro ao cadastrar aluno'),
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este aluno e todos os seus cursos?')) {
      deleteStudent.mutate(id, {
        onSuccess: () => toast.success('Aluno excluído!'),
      });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(fileName);
      setForm(f => ({ ...f, photo_url: urlData.publicUrl }));
      toast.success('Foto enviada!');
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const getPairedDay = (day: string): string | null => {
    const pairs: Record<string, string> = {
      'Segunda': 'Quarta', 'Quarta': 'Segunda',
      'Terça': 'Quinta', 'Quinta': 'Terça',
    };
    return pairs[day] || null;
  };

  const toggleDayTime = (day: string, time: string) => {
    setForm(f => {
      const newDaySchedules = { ...f.daySchedules };
      const applyToggle = (d: string) => {
        const current = newDaySchedules[d] || [];
        const updated = current.includes(time)
          ? current.filter(t => t !== time)
          : [...current, time];
        if (updated.length === 0) {
          delete newDaySchedules[d];
        } else {
          newDaySchedules[d] = updated;
        }
      };
      applyToggle(day);
      if (!f.customScheduleMode) {
        const paired = getPairedDay(day);
        if (paired) applyToggle(paired);
      }
      return { ...f, daySchedules: newDaySchedules };
    });
  };

  const showGuardian = form.show_guardian || isMinor(form.birth_date);

  const historyStudent = students?.find((s: any) => s.id === historyStudentId);
  const studentCompletions = completions?.filter(c => c.student_id === historyStudentId) ?? [];

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(o => o.value === status)?.label || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finalizado': return 'text-green-600';
      case 'desistiu': return 'text-destructive';
      default: return 'text-primary';
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Alunos</h1>
        <Button onClick={openNew} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> Novo Aluno</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-2">
        {filtered.map((s: any) => (
          <div key={s.id} className="bg-card border rounded-lg px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Avatar className="h-8 w-8 shrink-0 cursor-pointer" onClick={() => s.photo_url && setLightboxUrl(s.photo_url)}>
                {s.photo_url && <AvatarImage src={s.photo_url} alt={s.full_name} />}
                <AvatarFallback className="text-xs">{(s.full_name || '?')[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => setObservationsStudentId(s.id)}
                className="font-medium truncate text-sm sm:text-base text-left hover:underline flex items-center gap-1.5 min-w-0"
                title="Ver observações"
              >
                <span className="truncate">{s.full_name || 'Sem nome'}</span>
                {studentsWithObs?.has(s.id) && (
                  <span className="shrink-0 h-2 w-2 rounded-full bg-destructive" title="Possui observações" />
                )}
              </button>
            </div>
            <div className="flex gap-1 ml-auto">
              <Button size="icon" variant="ghost" className="relative" onClick={() => setObservationsStudentId(s.id)} title="Observações">
                <MessageSquare className="h-4 w-4" />
                {studentsWithObs?.has(s.id) && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-card" />
                )}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setFrequencyStudentId(s.id)} title="Frequência">
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setHistoryStudentId(s.id)} title="Histórico">
                <History className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => {
                const activeSc = (s.student_courses ?? []).find((sc: any) => sc.is_active);
                if (activeSc) {
                  openEditCourse(s, activeSc);
                } else if (s.student_courses?.length > 0) {
                  openEditCourse(s, s.student_courses[0]);
                } else {
                  openAddCourse(s.id, s);
                }
              }} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} title="Excluir">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>}
      </div>

      {/* Course History Dialog */}
      <Dialog open={!!historyStudentId} onOpenChange={() => setHistoryStudentId(null)}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Histórico - {historyStudent?.full_name || 'Aluno'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button size="sm" variant="outline" onClick={() => { if (historyStudentId && historyStudent) { openAddCourse(historyStudentId, historyStudent); setHistoryStudentId(null); } }}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Curso
            </Button>

            {historyStudent?.student_courses?.filter((sc: any) => sc.is_active).length > 0 && (
              <>
                <p className="text-sm font-medium text-muted-foreground">Cursos Ativos</p>
                {historyStudent.student_courses.filter((sc: any) => sc.is_active).map((sc: any) => (
                  <div key={sc.id} className="border rounded-lg p-3 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{sc.courses?.name || sc.custom_course_name || 'Sem curso'}</p>
                        <p className="text-xs text-muted-foreground">Carga horária: {sc.workload}h</p>
                        {sc.enrollment_date && <p className="text-xs text-muted-foreground">Matrícula: {sc.enrollment_date}</p>}
                        {sc.first_class_date && <p className="text-xs text-muted-foreground">Início: {sc.first_class_date}</p>}
                        <p className={`text-xs font-medium ${getStatusColor(sc.status)}`}>{getStatusLabel(sc.status)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { openEditCourse(historyStudent, sc); setHistoryStudentId(null); }} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm('Remover este curso do histórico?')) return;
                          // Delete schedules first, then student_course
                          await supabase.from('student_schedules').delete().eq('student_course_id', sc.id);
                          const scTableDyn = (supabase as any).from('student_courses');
                          await scTableDyn.delete().eq('id', sc.id);
                          toast.success('Curso removido!');
                          // Force refetch
                          window.location.reload();
                        }} title="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {historyStudent?.student_courses?.filter((sc: any) => !sc.is_active).length > 0 && (
              <>
                <p className="text-sm font-medium text-muted-foreground">Cursos Inativos</p>
                {historyStudent.student_courses.filter((sc: any) => !sc.is_active).map((sc: any) => (
                  <div key={sc.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{sc.courses?.name || sc.custom_course_name || 'Sem curso'}</p>
                        <p className={`text-xs font-medium ${getStatusColor(sc.status)}`}>{getStatusLabel(sc.status)}</p>
                        {sc.enrollment_date && <p className="text-xs text-muted-foreground">Matrícula: {sc.enrollment_date}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { openEditCourse(historyStudent, sc); setHistoryStudentId(null); }} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm('Remover este curso do histórico?')) return;
                          await supabase.from('student_schedules').delete().eq('student_course_id', sc.id);
                          const scTableDyn = (supabase as any).from('student_courses');
                          await scTableDyn.delete().eq('id', sc.id);
                          toast.success('Curso removido!');
                          window.location.reload();
                        }} title="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {studentCompletions.length > 0 && (
              <>
                <p className="text-sm font-medium text-muted-foreground">Cursos Concluídos (histórico)</p>
                {studentCompletions.map(c => (
                  <div key={c.id} className="border rounded-lg p-3">
                    <p className="font-medium">{c.course_name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{c.start_date ?? '-'} → {c.end_date}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {addCourseStudentId ? 'Adicionar Curso' : editingStudentId ? 'Editar Aluno / Curso' : 'Novo Aluno'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Personal Data */}
            {/* Photo Upload */}
            <div className="flex items-center gap-4 mb-2">
              <Avatar className="h-16 w-16 cursor-pointer" onClick={() => form.photo_url && setLightboxUrl(form.photo_url)}>
                {form.photo_url && <AvatarImage src={form.photo_url} alt="Foto" />}
                <AvatarFallback><Camera className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
              </Avatar>
              <div>
                <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoUpload} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                  {uploadingPhoto ? 'Enviando...' : form.photo_url ? 'Trocar foto' : 'Adicionar foto'}
                </Button>
                {form.photo_url && (
                  <Button type="button" variant="ghost" size="sm" className="ml-2 text-destructive" onClick={() => setForm(f => ({ ...f, photo_url: '' }))}>
                    Remover
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Nome completo</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} disabled={!!addCourseStudentId} /></div>
              {isAdmin && <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} /></div>}
              {isAdmin && <div><Label>Rua</Label><Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>}
              {isAdmin && <div><Label>Número</Label><Input value={form.house_number} onChange={e => setForm(f => ({ ...f, house_number: e.target.value }))} /></div>}
              <div><Label>Data de nascimento</Label><DateInput value={form.birth_date} onChange={v => setForm(f => ({ ...f, birth_date: v }))} /></div>
              {isAdmin && <div><Label>Data da matrícula</Label><DateInput value={form.enrollment_date} onChange={v => setForm(f => ({ ...f, enrollment_date: v }))} /></div>}
              <div><Label>Data do primeiro dia de aula</Label><DateInput value={form.first_class_date} onChange={v => setForm(f => ({ ...f, first_class_date: v }))} /></div>
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

            {/* Course Data */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Dados do Curso</h3>
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
                {isAdmin && (
                  <div>
                    <Label>Forma de pagamento</Label>
                    <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Schedule Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold">Dias e Horários</Label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={form.customScheduleMode}
                    onCheckedChange={v => setForm(f => ({ ...f, customScheduleMode: v, daySchedules: {} }))}
                  />
                  Horários personalizados
                </label>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                {form.customScheduleMode
                  ? 'Modo personalizado: selecione livremente qualquer combinação de dia e horário.'
                  : 'Modo padrão: Segunda↔Quarta e Terça↔Quinta são pareados automaticamente.'}
              </p>

              {!form.customScheduleMode ? (
                <div className="space-y-3">
                  <div className="border rounded-lg p-3">
                    <span className="font-medium text-sm block mb-2">Segunda e Quarta</span>
                    <div className="flex flex-wrap gap-2 ml-2">
                      {WEEKDAY_TIMES.map(t => {
                        const tk = timeKey(t.start, t.end);
                        return (
                          <label key={tk} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox checked={(form.daySchedules['Segunda'] || []).includes(tk)} onCheckedChange={() => toggleDayTime('Segunda', tk)} />
                            {t.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <span className="font-medium text-sm block mb-2">Terça e Quinta</span>
                    <div className="flex flex-wrap gap-2 ml-2">
                      {WEEKDAY_TIMES.map(t => {
                        const tk = timeKey(t.start, t.end);
                        return (
                          <label key={tk} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox checked={(form.daySchedules['Terça'] || []).includes(tk)} onCheckedChange={() => toggleDayTime('Terça', tk)} />
                            {t.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <span className="font-medium text-sm block mb-2">Sábado</span>
                    <div className="flex flex-wrap gap-2 ml-2">
                      {SATURDAY_TIMES.map(t => {
                        const tk = timeKey(t.start, t.end);
                        return (
                          <label key={tk} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox checked={(form.daySchedules['Sábado'] || []).includes(tk)} onCheckedChange={() => toggleDayTime('Sábado', tk)} />
                            {t.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
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
                                <Checkbox checked={dayTimes.includes(tk)} onCheckedChange={() => toggleDayTime(day, tk)} />
                                {t.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {Object.keys(form.daySchedules).length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {computeScheduleIds(form.daySchedules).length} combinações de dia/horário serão registradas.
                </p>
              )}
            </div>

            {/* Material Sent */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.material_sent} onCheckedChange={v => setForm(f => ({ ...f, material_sent: !!v }))} />
              <span className="text-sm">Material enviado</span>
            </label>

            <Button onClick={handleSave} disabled={createStudent.isPending || updateStudent.isPending}>
              {addCourseStudentId ? 'Adicionar Curso' : editingStudentId ? 'Salvar Alterações' : 'Cadastrar Aluno'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Frequency Dialog */}
      <StudentFrequencyDialog
        open={!!frequencyStudentId}
        onOpenChange={() => setFrequencyStudentId(null)}
        studentId={frequencyStudentId}
        studentName={students?.find((s: any) => s.id === frequencyStudentId)?.full_name || 'Aluno'}
        courseName={(() => {
          const s = students?.find((st: any) => st.id === frequencyStudentId);
          const activeSc = s?.student_courses?.find((sc: any) => sc.is_active);
          return activeSc?.courses?.name || activeSc?.custom_course_name || undefined;
        })()}
      />

      <PhotoLightbox
        open={!!lightboxUrl}
        onOpenChange={() => setLightboxUrl(null)}
        src={lightboxUrl || ''}
        alt="Foto do aluno"
      />

      <StudentObservationsDialog
        open={!!observationsStudentId}
        onOpenChange={() => setObservationsStudentId(null)}
        studentId={observationsStudentId}
        studentName={students?.find((s: any) => s.id === observationsStudentId)?.full_name || 'Aluno'}
      />
    </div>
  );
}
