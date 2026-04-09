import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  studentName: string;
}

export function StudentObservationsDialog({ open, onOpenChange, studentId, studentName }: Props) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: observations } = useQuery({
    queryKey: ['student_observations', studentId],
    enabled: !!studentId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_observations')
        .select('*')
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleAdd = async () => {
    if (!text.trim() || !studentId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('student_observations').insert({
        student_id: studentId,
        observation: text.trim(),
        source: 'manual',
      });
      if (error) throw error;
      setText('');
      toast.success('Observação adicionada!');
      qc.invalidateQueries({ queryKey: ['student_observations', studentId] });
      qc.invalidateQueries({ queryKey: ['obs_counts'] });
      qc.invalidateQueries({ queryKey: ['students_with_obs'] });
    } catch {
      toast.error('Erro ao salvar observação');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('student_observations').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    qc.invalidateQueries({ queryKey: ['student_observations', studentId] });
    qc.invalidateQueries({ queryKey: ['obs_counts'] });
    qc.invalidateQueries({ queryKey: ['students_with_obs'] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Observações - {studentName}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Textarea
            placeholder="Escreva uma observação..."
            value={text}
            onChange={e => setText(e.target.value)}
            className="min-h-[60px]"
          />
          <Button size="icon" onClick={handleAdd} disabled={saving || !text.trim()} className="shrink-0 self-end">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 mt-2">
          {observations?.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">Nenhuma observação registrada.</p>
          )}
          {observations?.map((obs: any) => (
            <div key={obs.id} className="border rounded-lg p-3 bg-muted/30">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm whitespace-pre-wrap flex-1">{obs.observation}</p>
                <Button size="icon" variant="ghost" className="shrink-0 h-6 w-6" onClick={() => handleDelete(obs.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(obs.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {obs.source === 'chamada' && ' • via chamada'}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
