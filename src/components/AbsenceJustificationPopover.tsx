import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Info, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  isJustified: boolean;
  note: string;
  onSave: (values: { isJustified: boolean; note: string }) => void;
  checkboxLabel?: string;
  triggerTitle?: string;
  triggerClassName?: string;
  align?: 'start' | 'center' | 'end';
}

export function AbsenceJustificationPopover({ isJustified, note, onSave, checkboxLabel, triggerTitle, triggerClassName, align = 'end' }: Props) {
  const [open, setOpen] = useState(false);
  const [localJustified, setLocalJustified] = useState(isJustified);
  const [localNote, setLocalNote] = useState(note || '');

  useEffect(() => {
    if (open) {
      setLocalJustified(isJustified);
      setLocalNote(note || '');
    }
  }, [open, isJustified, note]);

  const handleSave = () => {
    onSave({ isJustified: localJustified, note: localNote.trim() });
    setOpen(false);
  };

  const hasInfo = isJustified || !!(note && note.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn('h-8 w-8', triggerClassName)}
          title={triggerTitle || (isJustified ? 'Falta justificada' : 'Marcar como justificada / observação')}
        >
          {isJustified ? (
            <ShieldCheck className={cn('h-4 w-4', 'text-green-600')} />
          ) : (
            <Info className={cn('h-4 w-4', hasInfo ? 'text-blue-600' : 'text-muted-foreground')} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align={align}>
        <div className="flex items-center gap-2">
          <Checkbox
            id="justified"
            checked={localJustified}
            onCheckedChange={(v) => setLocalJustified(!!v)}
          />
          <Label htmlFor="justified" className="text-sm cursor-pointer">
            {checkboxLabel || 'Falta justificada'}
          </Label>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Observação da falta</Label>
          <Textarea
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            placeholder="Ex.: consulta médica, viagem, atestado..."
            className="min-h-[70px] text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}>Salvar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
