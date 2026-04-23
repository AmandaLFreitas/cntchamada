import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUSES = ['OK', 'OK.FECHOU', 'NÃO VEIO', 'DESMARCOU', 'REMARCOU'] as const;

interface TrialLesson {
  id: string;
  student_name: string;
  phone: string | null;
  course: string | null;
  time_slot: string | null;
  lesson_date: string;
  status: string;
}

const emptyForm = {
  student_name: '',
  phone: '',
  course: '',
  time_slot: '',
  lesson_date: format(new Date(), 'yyyy-MM-dd'),
  status: 'OK',
};

export default function TrialLessons() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['trial_lessons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_lessons')
        .select('*')
        .order('lesson_date', { ascending: false });
      if (error) throw error;
      return data as TrialLesson[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: typeof emptyForm & { id?: string }) => {
      const payload = {
        student_name: values.student_name,
        phone: values.phone || null,
        course: values.course || null,
        time_slot: values.time_slot || null,
        lesson_date: values.lesson_date,
        status: values.status,
      };
      if (values.id) {
        const { error } = await supabase.from('trial_lessons').update(payload).eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('trial_lessons').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_lessons'] });
      toast.success(editingId ? 'Registro atualizado' : 'Registro cadastrado');
      closeDialog();
    },
    onError: () => toast.error('Erro ao salvar registro'),
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
      const { error } = await supabase.from('trial_lessons').update({ status }).eq('id', id);
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
      phone: lesson.phone || '',
      course: lesson.course || '',
      time_slot: lesson.time_slot || '',
      lesson_date: lesson.lesson_date,
      status: lesson.status,
    });
    setDialogOpen(true);
  };

  const filtered = useMemo(() => {
    return lessons.filter(l => {
      const matchName = !search || l.student_name.toLowerCase().includes(search.toLowerCase());
      const matchDate = !dateFilter || l.lesson_date === dateFilter;
      return matchName && matchDate;
    });
  }, [lessons, search, dateFilter]);

  const handleSubmit = () => {
    if (!form.student_name.trim()) {
      toast.error('Nome do aluno é obrigatório');
      return;
    }
    upsert.mutate(editingId ? { ...form, id: editingId } : form);
  };

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Aulas Experimentais</h1>
        <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Aula
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="w-auto"
          placeholder="Filtrar por data"
        />
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => setDateFilter('')}>Limpar data</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma aula experimental encontrada.</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead className="hidden sm:table-cell">Curso</TableHead>
                <TableHead className="hidden md:table-cell">Horário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.student_name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{l.phone || '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{l.course || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell">{l.time_slot || '—'}</TableCell>
                  <TableCell>{formatDate(l.lesson_date)}</TableCell>
                  <TableCell>
                    <Select
                      value={l.status}
                      onValueChange={val => updateStatus.mutate({ id: l.id, status: val })}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              ))}
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
              <Label>Aluno *</Label>
              <Input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Curso</Label>
              <Input value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))} />
            </div>
            <div>
              <Label>Horário</Label>
              <Input value={form.time_slot} onChange={e => setForm(f => ({ ...f, time_slot: e.target.value }))} placeholder="Ex: 08:00 - 09:00" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.lesson_date} onChange={e => setForm(f => ({ ...f, lesson_date: e.target.value }))} />
            </div>
            <div>
              <Label>Situação</Label>
              <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
