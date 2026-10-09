import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fetchCompletionPlanning } from '@/lib/completion-planning-data';
import { downloadCompletionPlanning } from '@/lib/completion-planning-excel';

export function CompletionPlanningReport() {
  const { school, schools } = useSchool();
  const { isAdmin, role } = useAuth();
  const { toast } = useToast();
  const [scope, setScope] = useState('current');
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    const selected = scope === 'all' ? schools : school ? [school] : [];
    if (!selected.length || !role) return;
    setBusy(true);
    try {
      const rows = await fetchCompletionPlanning(selected, isAdmin);
      await downloadCompletionPlanning(rows, selected.map(unit => unit.name).join(', '), isAdmin);
      toast({ title: 'Excel gerado', description: `${new Set(rows.map(row => row.studentId)).size} alunos únicos • ${rows.length} matrículas.` });
    } catch {
      toast({ title: 'Não foi possível gerar o Excel', description: 'Tente novamente. Nenhum dado foi alterado.', variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Planejamento de Finalização de Cursos</h2>
      <p className="text-sm text-muted-foreground">01/01/2026 a 28/02/2027</p>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={scope} onValueChange={setScope} disabled={busy}>
          <SelectTrigger className="w-full sm:w-72" aria-label="Unidades do planejamento"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">{school?.name ?? 'Unidade selecionada'}</SelectItem>
            {schools.length > 1 && <SelectItem value="all">Todas as unidades autorizadas</SelectItem>}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={generate} disabled={busy || !school || !role} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {busy ? 'Gerando Excel...' : 'Gerar Excel de Finalizações'}
        </Button>
      </div>
    </section>
  );
}