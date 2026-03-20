import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function MonthlyReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const { data: stats } = useQuery({
    queryKey: ['monthly_stats', month, year],
    queryFn: async () => {
      // Active students: enrolled before end of month and still active
      const { data: active } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'em_andamento');

      // Finalized in this month
      const { data: finalized } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'finalizado')
        .gte('updated_at', startDate)
        .lte('updated_at', endDate + 'T23:59:59');

      // Dropouts in this month
      const { data: dropouts } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'desistiu')
        .gte('updated_at', startDate)
        .lte('updated_at', endDate + 'T23:59:59');

      // Attendance stats for the month
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, time_slot_id')
        .gte('date', startDate)
        .lte('date', endDate);

      const presencasPorSlot: Record<string, number> = {};
      const faltasPorSlot: Record<string, number> = {};
      attendance?.forEach(a => {
        if (a.status === 'present') presencasPorSlot[a.time_slot_id] = (presencasPorSlot[a.time_slot_id] || 0) + 1;
        if (a.status === 'absent') faltasPorSlot[a.time_slot_id] = (faltasPorSlot[a.time_slot_id] || 0) + 1;
      });

      return {
        active: active?.length ?? 0,
        finalized: finalized?.length ?? 0,
        dropouts: dropouts?.length ?? 0,
        totalPresencas: attendance?.filter(a => a.status === 'present').length ?? 0,
        totalFaltas: attendance?.filter(a => a.status === 'absent').length ?? 0,
      };
    },
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Relatório Mensal</h2>
      <div className="flex gap-3">
        <div>
          <Label className="text-xs">Mês</Label>
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ano</Label>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold text-primary">{stats?.active ?? 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Finalizados</p>
          <p className="text-2xl font-bold text-green-600">{stats?.finalized ?? 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Desistentes</p>
          <p className="text-2xl font-bold text-destructive">{stats?.dropouts ?? 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Presenças</p>
          <p className="text-2xl font-bold text-green-600">{stats?.totalPresencas ?? 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Faltas</p>
          <p className="text-2xl font-bold text-destructive">{stats?.totalFaltas ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
