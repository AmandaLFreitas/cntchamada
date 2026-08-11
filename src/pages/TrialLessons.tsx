import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Search, CalendarIcon, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { SmartDateInput } from '@/components/SmartDateInput';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn, openWhatsApp } from '@/lib/utils';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { Filter, X } from 'lucide-react';

const STATUSES = ['PENDENTE', 'OK', 'OK.FECHOU', 'NÃO VEIO', 'DESMARCOU', 'REMARCOU'] as const;
const STATUS_LABELS: Record<string, string> = {
  'PENDENTE': 'AGENDADO',
  'OK': 'COMPARECEU (SEM FECHAMENTO)',
  'OK.FECHOU': 'FECHOU MATRÍCULA',
  'NÃO VEIO': 'FALTOU',
  'DESMARCOU': 'CANCELADO',
  'REMARCOU': 'REAGENDADO',
};
const STATUS_DOTS: Record<string, string> = {
  'PENDENTE': 'bg-yellow-400',
  'OK': 'bg-blue-500',
  'OK.FECHOU': 'bg-green-500',
  'NÃO VEIO': 'bg-red-500',
  'DESMARCOU': 'bg-gray-500',
  'REMARCOU': 'bg-purple-500',
};
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ALL_MONTHS = '__all__';
const ALL_YEARS = '__all_years__';

interface TrialLesson {
  id: string;
  student_name: string;
  phone: string | null;
  course: string | null;
  time_slot: string | null;
  lesson_date: string;
  status: string;
  observations?: string | null;
  school_id: string;
  created_by_name?: string | null;
}

interface SchoolOption {
  id: string;
  name: string;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const statusRowClass = (status: string, lessonDate: string, today: string): string => {
  const s = (status || '').toUpperCase();
  const isToday = lessonDate === today;
  if (s === 'PENDENTE') {
    if (isToday) return 'bg-[#FFF3CD]/60 hover:bg-[#FFF3CD]/80';
    return '';
  }
  if (s === 'OK') return 'bg-[#D0E7FF]/60 hover:bg-[#D0E7FF]/80';
  if (s === 'OK.FECHOU') return 'bg-[#D4EDDA]/70 hover:bg-[#D4EDDA]/90';
  if (s === 'NÃO VEIO') return 'bg-[#F8D7DA]/70 hover:bg-[#F8D7DA]/90 border-l-4 border-l-red-400';
  if (s === 'DESMARCOU') return 'bg-[#E2E3E5]/70 hover:bg-[#E2E3E5]/90';
  if (s === 'REMARCOU') return 'bg-[#E6D6F5]/70 hover:bg-[#E6D6F5]/90';
  if (isToday) return 'bg-blue-100/40 hover:bg-blue-200/40';
  return '';
};

const needsContact = (status: string) => {
  const s = (status || '').toUpperCase();
  return s === 'NÃO VEIO' || s === 'DESMARCOU';
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Auto-format input like "8" -> "08:00", "830" -> "08:30", "1430" -> "14:30"
const formatTimeSlot = (raw: string): string => {
  const v = (raw || '').trim();
  if (!v) return '';
  // If it already contains a range or colon, leave alone
  if (v.includes('-')) return v;
  const digits = v.replace(/\D/g, '');
  if (!digits) return v;
  let hh = '', mm = '';
  if (digits.length === 1) { hh = '0' + digits; mm = '00'; }
  else if (digits.length === 2) { hh = digits; mm = '00'; }
  else if (digits.length === 3) { hh = '0' + digits[0]; mm = digits.slice(1); }
  else { hh = digits.slice(0, 2); mm = digits.slice(2, 4); }
  const h = Math.min(parseInt(hh, 10) || 0, 23);
  const m = Math.min(parseInt(mm, 10) || 0, 59);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const todayDDMMYYYY = (() => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
})();

const ddmmyyyyToISO = (v: string) => {
  const parts = v.split('/');
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const isoToDDMMYYYY = (v: string) => {
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
};

const SCHEDULERS = ['Elisa', 'Duda', 'Cris'] as const;

const emptyForm = {
  student_name: '',
  phone: '',
  course: '',
  time_slot: '',
  lesson_date: todayDDMMYYYY,
  status: 'PENDENTE',
  observations: '',
  school_id: '',
  created_by_name: '',
};

export default function TrialLessons() {
  const queryClient = useQueryClient();
  const { schoolId, schools } = useSchool();
  const { user, displayName, canManageAllTrialLessons } = useAuth();
  const now = new Date();
  const [search, setSearch] = useState('');
  const [viewSchoolId, setViewSchoolId] = useState<string | null>(schoolId);
  const [filterMonth, setFilterMonth] = useState<string>(String(now.getMonth()));
  const [filterYear, setFilterYear] = useState<string>(String(now.getFullYear()));
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setViewSchoolId(schoolId);
  }, [schoolId]);


  const toggleStatus = (s: string) => {
    setFilterStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterMonth(ALL_MONTHS);
    setFilterYear(ALL_YEARS);
    setFilterDate(undefined);
    setFilterStatuses([]);
  };

  const hasActiveFilters = !!search || filterMonth !== ALL_MONTHS || filterYear !== ALL_YEARS || !!filterDate || filterStatuses.length > 0;

  // Fetch all schools (bypass user-allowed filter, so Cris sees Toledo + Cascavel here)
  const { data: allSchools = [] } = useQuery({
    queryKey: ['trial_lessons_schools'],
    queryFn: async () => {
      const { data, error } = await supabase.from('schools').select('id, name').order('name');
      if (error) throw error;
      return (data ?? []) as SchoolOption[];
    },
  });
  const schoolNameById = useMemo(() => {
    const m = new Map<string, string>();
    allSchools.forEach(s => m.set(s.id, s.name));
    return m;
  }, [allSchools]);

  // Units the user may browse here: their own units + all units for cross-unit access (Cris)
  const selectableSchools = useMemo(() => {
    if (canManageAllTrialLessons) return allSchools;
    return allSchools.filter(s => schools.some(us => us.id === s.id));
  }, [allSchools, schools, canManageAllTrialLessons]);

  const activeSchoolId = viewSchoolId ?? schoolId;

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['trial_lessons', activeSchoolId],
    enabled: !!activeSchoolId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trial_lessons')
        .select('*')
        .eq('school_id', activeSchoolId!)
        .order('lesson_date', { ascending: false });
      if (error) throw error;
      return data as TrialLesson[];
    },
  });


  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: typeof emptyForm & { id?: string }) => {
      const targetSchool = values.school_id || activeSchoolId;
      if (!targetSchool) throw new Error('Selecione a unidade da aula experimental');
      const isoDate = ddmmyyyyToISO(values.lesson_date);
      if (!isoDate) throw new Error('Data inválida');
      const payload: any = {
        student_name: values.student_name,
        phone: values.phone.replace(/\D/g, '') || null,
        course: values.course || null,
        time_slot: values.time_slot || null,
        lesson_date: isoDate,
        status: values.status,
        observations: values.observations || null,
        school_id: targetSchool,
        created_by_name: values.created_by_name || null,
      };
      if (values.id) {
        const { error } = await (supabase as any).from('trial_lessons').update(payload).eq('id', values.id);
        if (error) throw error;
      } else {
        payload.created_by_user_id = user?.id ?? null;
        const { error } = await (supabase as any).from('trial_lessons').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_lessons'] });
      toast.success(editingId ? 'Registro atualizado' : 'Registro cadastrado');
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar registro'),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trial_lessons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_lessons'] });
      toast.success('Registro excluído');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from('trial_lessons').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trial_lessons'] }),
  });

  const updateObservation = useMutation({
    mutationFn: async ({ id, observations }: { id: string; observations: string }) => {
      const { error } = await (supabase as any).from('trial_lessons').update({ observations }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trial_lessons'] }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (lesson: TrialLesson) => {
    setEditingId(lesson.id);
    setForm({
      student_name: lesson.student_name,
      phone: lesson.phone ? formatPhone(lesson.phone) : '',
      course: lesson.course || '',
      time_slot: lesson.time_slot || '',
      lesson_date: isoToDDMMYYYY(lesson.lesson_date),
      status: lesson.status,
      observations: lesson.observations || '',
      school_id: lesson.school_id || '',
      created_by_name: lesson.created_by_name || '',
    });
    setDialogOpen(true);
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(now.getFullYear());
    lessons.forEach(l => {
      const y = parseInt(l.lesson_date.slice(0, 4), 10);
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [lessons]);

  const filtered = useMemo(() => {
    return lessons.filter(l => {
      const matchName = !search || l.student_name.toLowerCase().includes(search.toLowerCase());
      const [yStr, mStr, dStr] = l.lesson_date.split('-');
      const lessonY = parseInt(yStr, 10);
      const lessonM = parseInt(mStr, 10) - 1;
      const lessonD = parseInt(dStr, 10);

      const matchYear = filterYear === ALL_YEARS || lessonY === parseInt(filterYear, 10);
      const matchMonth = filterMonth === ALL_MONTHS || lessonM === parseInt(filterMonth, 10);

      let matchDate = true;
      if (filterDate) {
        matchDate =
          lessonY === filterDate.getFullYear() &&
          lessonM === filterDate.getMonth() &&
          lessonD === filterDate.getDate();
      }
      const matchStatus = filterStatuses.length === 0 || filterStatuses.includes(l.status);
      return matchName && matchYear && matchMonth && matchDate && matchStatus;
    });
  }, [lessons, search, filterMonth, filterYear, filterDate, filterStatuses]);

  const handleSubmit = () => {
    if (!form.student_name.trim()) {
      toast.error('Nome do aluno é obrigatório');
      return;
    }
    if (!ddmmyyyyToISO(form.lesson_date)) {
      toast.error('Data inválida. Use o formato dd/mm/aaaa');
      return;
    }
    if (!form.school_id) {
      toast.error('Selecione a unidade');
      return;
    }
    upsert.mutate(editingId ? { ...form, id: editingId } : form);
  };

  const formatSelectedDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const openNew = () => {
    const defaultScheduler = (SCHEDULERS as readonly string[]).includes(displayName || '') ? (displayName as string) : '';
    setForm({ ...emptyForm, school_id: activeSchoolId ?? '', created_by_name: defaultScheduler });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Aulas Experimentais</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova Aula
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MONTHS}>Todos os meses</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_YEARS}>Todos os anos</SelectItem>
            {availableYears.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'justify-start text-left font-normal w-[180px]',
                !filterDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filterDate ? formatSelectedDate(filterDate) : 'Filtrar por dia'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filterDate}
              onSelect={(d) => { setFilterDate(d); setDatePopoverOpen(false); }}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
        <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start font-normal min-w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              {filterStatuses.length === 0
                ? 'Filtrar por situação'
                : `${filterStatuses.length} situaç${filterStatuses.length === 1 ? 'ão' : 'ões'}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-1">
              {STATUSES.map(s => (
                <label
                  key={s}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={filterStatuses.includes(s)}
                    onCheckedChange={() => toggleStatus(s)}
                  />
                  <span className={cn('inline-block h-2.5 w-2.5 rounded-full', STATUS_DOTS[s])} />
                  <span>{STATUS_LABELS[s]}</span>
                </label>
              ))}
              {filterStatuses.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => setFilterStatuses([])}
                >
                  <X className="mr-1 h-3 w-3" /> Limpar situações
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" /> Limpar filtros
          </Button>
        )}
      </div>

      {filterStatuses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterStatuses.map(s => (
            <Badge
              key={s}
              variant="secondary"
              className="gap-1.5 cursor-pointer"
              onClick={() => toggleStatus(s)}
            >
              <span className={cn('inline-block h-2 w-2 rounded-full', STATUS_DOTS[s])} />
              {STATUS_LABELS[s]}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma aula experimental encontrada.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead className="hidden sm:table-cell">Curso</TableHead>
                <TableHead className="hidden md:table-cell">Horário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="hidden md:table-cell">Unidade</TableHead>
                <TableHead className="hidden lg:table-cell">Agendado por</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="min-w-[180px]">Observações</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => {
                const isToday = l.lesson_date === todayISO();
                const rowClass = statusRowClass(l.status, l.lesson_date, todayISO());
                const showAlert = needsContact(l.status);
                return (
                  <TableRow key={l.id} className={rowClass}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => openWhatsApp(l.phone)}
                          className="text-left hover:underline hover:text-green-700"
                          title={l.phone ? 'Abrir WhatsApp' : 'Sem telefone'}
                        >
                          {l.student_name}
                        </button>
                        {showAlert && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700">
                            <AlertTriangle className="h-3 w-3" /> Entrar em contato com o aluno
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {l.phone ? (
                        <button onClick={() => openWhatsApp(l.phone)} className="hover:underline hover:text-green-700">
                          {formatPhone(l.phone)}
                        </button>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{l.course || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">{l.time_slot || '—'}</TableCell>
                    <TableCell>{isoToDDMMYYYY(l.lesson_date)}</TableCell>
                    <TableCell className="hidden md:table-cell">{schoolNameById.get(l.school_id) || '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{l.created_by_name || '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={l.status}
                        onValueChange={val => updateStatus.mutate({ id: l.id, status: val })}
                      >
                        <SelectTrigger className="h-8 w-[200px] text-xs bg-background">
                          <SelectValue>{STATUS_LABELS[l.status] ?? l.status}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={l.observations || ''}
                        placeholder="Observação..."
                        className="h-8 text-xs bg-background"
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== (l.observations || '')) {
                            updateObservation.mutate({ id: l.id, observations: v });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(l.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Aula Experimental' : 'Nova Aula Experimental'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Unidade *</Label>
              <Select value={form.school_id} onValueChange={val => setForm(f => ({ ...f, school_id: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  {allSchools.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aluno *</Label>
              <Input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                inputMode="numeric"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label>Curso</Label>
              <Select value={form.course} onValueChange={val => setForm(f => ({ ...f, course: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar curso" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Horário</Label>
                <Input
                  value={form.time_slot}
                  onChange={e => setForm(f => ({ ...f, time_slot: e.target.value }))}
                  onBlur={e => setForm(f => ({ ...f, time_slot: formatTimeSlot(e.target.value) }))}
                  inputMode="numeric"
                  placeholder="Ex: 08:00 ou 0830"
                />
              </div>
              <div>
                <Label>Data</Label>
                <SmartDateInput
                  value={form.lesson_date}
                  onChange={val => setForm(f => ({ ...f, lesson_date: val }))}
                />
              </div>
            </div>
            <div>
              <Label>Situação</Label>
              <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                <SelectTrigger>
                  <SelectValue>{STATUS_LABELS[form.status] ?? form.status}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agendado por</Label>
              <Select value={form.created_by_name} onValueChange={val => setForm(f => ({ ...f, created_by_name: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULERS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.observations}
                onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Observações sobre a aula..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={upsert.isPending}>
              {editingId ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
