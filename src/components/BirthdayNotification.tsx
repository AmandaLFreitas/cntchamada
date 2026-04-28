import { useStudents, useCourses } from '@/hooks/use-supabase-data';
import { Cake, X, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';

function parseBirthDate(dateStr: string | null): { day: number; month: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) return { day: parseInt(parts[0]), month: parseInt(parts[1]) };
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return { day: d.getDate(), month: d.getMonth() + 1 };
  return null;
}

export function BirthdayNotification() {
  const { data: students } = useStudents();
  const [minimized, setMinimized] = useState(true);

  const birthdays = useMemo(() => {
    if (!students?.length) return { today: [] as string[], week: [] as { name: string; date: string }[], month: [] as { name: string; date: string }[] };
    const now = new Date();
    const td = now.getDate(), tm = now.getMonth() + 1;
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);

    const today: string[] = [];
    const week: { name: string; date: string }[] = [];
    const month: { name: string; date: string }[] = [];

    students.forEach(s => {
      const bd = parseBirthDate(s.birth_date ?? null);
      if (!bd) return;
      const dateLabel = `${String(bd.day).padStart(2, '0')}/${String(bd.month).padStart(2, '0')}`;

      if (bd.day === td && bd.month === tm) {
        today.push(s.full_name || 'Sem nome');
      }
      const bday = new Date(now.getFullYear(), bd.month - 1, bd.day);
      if (bday >= startOfWeek && bday <= endOfWeek && !(bd.day === td && bd.month === tm)) {
        week.push({ name: s.full_name || 'Sem nome', date: dateLabel });
      }
      if (bd.month === tm && !(bd.day === td && bd.month === tm)) {
        month.push({ name: s.full_name || 'Sem nome', date: dateLabel });
      }
    });
    return { today, week, month };
  }, [students]);

  const hasAny = birthdays.today.length > 0 || birthdays.week.length > 0 || birthdays.month.length > 0;
  if (!hasAny) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 bg-amber-500 text-white rounded-full p-3 shadow-lg hover:bg-amber-600 transition-colors"
        title="Ver aniversariantes"
      >
        <Cake className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {birthdays.today.length + birthdays.week.length + birthdays.month.length}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 bg-card border shadow-xl rounded-lg overflow-hidden">
      <div className="bg-amber-500 text-white px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Cake className="h-4 w-4" /> Aniversariantes
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-amber-600 rounded">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-amber-600 rounded" title="Fechar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 text-sm max-h-48 overflow-auto space-y-2">
        {birthdays.today.length > 0 && (
          <div>
            <p className="font-medium text-amber-700">🎂 Hoje</p>
            {birthdays.today.map((n, i) => <p key={i} className="ml-2">{n}</p>)}
          </div>
        )}
        {birthdays.week.length > 0 && (
          <div>
            <p className="font-medium text-amber-700">🎉 Esta semana</p>
            {birthdays.week.map((b, i) => <p key={i} className="ml-2">{b.name} ({b.date})</p>)}
          </div>
        )}
        {birthdays.month.length > 0 && birthdays.today.length === 0 && birthdays.week.length === 0 && (
          <div>
            <p className="font-medium text-amber-700">📅 Este mês</p>
            {birthdays.month.map((b, i) => <p key={i} className="ml-2">{b.name} ({b.date})</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
