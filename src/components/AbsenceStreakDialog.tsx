import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { ShieldCheck, MessageCircle } from 'lucide-react';

interface StreakRow {
  studentId: string;
  studentName: string;
  firstAbsentInStreakISO: string | null;
  lastAbsentInStreakISO: string | null;
  streak: number;
  streakJustified: boolean;
  streakNote: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: StreakRow | null;
  schoolId: string | null;
  onSave: (values: { isJustified: boolean; note: string }) => void;
}

const fmtBR = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export function AbsenceStreakDialog({ open, onOpenChange, row, schoolId, onSave }: Props) {
  const [justified, setJustified] = useState(false);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<Array<{ date: string; is_justified: boolean; absence_note: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setJustified(row.streakJustified);
    setNote(row.streakNote || '');
  }, [open, row]);

  useEffect(() => {
    if (!open || !row || !schoolId || !row.firstAbsentInStreakISO || !row.lastAbsentInStreakISO) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from('attendance')
        .select('date, is_justified, absence_note')
        .eq('school_id', schoolId)
        .eq('student_id', row.studentId)
        .eq('status', 'absent')
        .gte('date', row.firstAbsentInStreakISO)
        .lte('date', row.lastAbsentInStreakISO)
        .order('date', { ascending: true });
      if (cancelled) return;
      const seen = new Set<string>();
      const rows = (data ?? []).filter((r: any) => {
        if (seen.has(r.date)) return false;
        seen.add(r.date);
        return true;
      });
      setHistory(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, row, schoolId]);

  const handleSave = () => {
    onSave({ isJustified: justified, note: note.trim() });
    onOpenChange(false);
  };

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-orange-600" />
            {row.studentName}
          </DialogTitle>
          <DialogDescription>
            {row.streak} faltas consecutivas registradas
            {row.firstAbsentInStreakISO && row.lastAbsentInStreakISO && (
              <> — de {fmtBR(row.firstAbsentInStreakISO)} até {fmtBR(row.lastAbsentInStreakISO)}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
            <Checkbox
              id="msg-sent"
              checked={justified}
              onCheckedChange={(v) => setJustified(!!v)}
            />
            <Label htmlFor="msg-sent" className="text-sm cursor-pointer flex items-center gap-1.5">
              {justified ? <ShieldCheck className="h-4 w-4 text-green-600" /> : null}
              Mensagem enviada
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Observação da sequência de faltas</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: aluno em viagem, atestado médico, contato realizado..."
              className="min-h-[90px] text-sm"
            />
            <p className="text-xs text-muted-foreground">
              A observação será aplicada a todas as faltas desta sequência.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Histórico da sequência</Label>
            {loading ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum registro encontrado.</p>
            ) : (
              <ul className="border rounded-md divide-y text-sm max-h-48 overflow-auto">
                {history.map((h) => (
                  <li key={h.date} className="p-2 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{fmtBR(h.date)}</p>
                      {h.absence_note && (
                        <p className="text-xs text-muted-foreground break-words">{h.absence_note}</p>
                      )}
                    </div>
                    {h.is_justified && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs text-green-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> enviada
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
