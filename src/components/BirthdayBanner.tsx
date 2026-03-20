import { useStudents } from '@/hooks/use-supabase-data';
import { Cake } from 'lucide-react';
import { useMemo } from 'react';

function parseBirthDate(dateStr: string | null): { day: number; month: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) return { day: parseInt(parts[0]), month: parseInt(parts[1]) };
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return { day: d.getDate(), month: d.getMonth() + 1 };
  return null;
}

export function BirthdayBanner() {
  const { data: students } = useStudents();

  const birthdays = useMemo(() => {
    if (!students?.length) return { today: [] as string[], week: [] as { name: string; date: string }[] };
    const now = new Date();
    const td = now.getDate(), tm = now.getMonth() + 1;
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);

    const today: string[] = [];
    const week: { name: string; date: string }[] = [];

    students.forEach(s => {
      const bd = parseBirthDate(s.birth_date ?? null);
      if (!bd) return;
      if (bd.day === td && bd.month === tm) {
        today.push(s.full_name || 'Sem nome');
      } else {
        const bday = new Date(now.getFullYear(), bd.month - 1, bd.day);
        if (bday >= startOfWeek && bday <= endOfWeek) {
          week.push({ name: s.full_name || 'Sem nome', date: `${String(bd.day).padStart(2, '0')}/${String(bd.month).padStart(2, '0')}` });
        }
      }
    });
    return { today, week };
  }, [students]);

  if (birthdays.today.length === 0 && birthdays.week.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
      <Cake className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
      <div className="text-sm">
        {birthdays.today.length > 0 && (
          <p className="font-medium">🎂 Aniversariante(s) de hoje: {birthdays.today.join(', ')}</p>
        )}
        {birthdays.week.length > 0 && (
          <p>🎉 Da semana: {birthdays.week.map(b => `${b.name} (${b.date})`).join(', ')}</p>
        )}
      </div>
    </div>
  );
}
