import { useEffect } from 'react';
import { useStudents } from '@/hooks/use-supabase-data';
import { toast } from 'sonner';

function parseBirthDate(dateStr: string | null): { day: number; month: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return { day: parseInt(parts[0]), month: parseInt(parts[1]) };
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return { day: d.getDate(), month: d.getMonth() + 1 };
  }
  return null;
}

export function BirthdayAlert() {
  const { data: students } = useStudents();

  useEffect(() => {
    if (!students || students.length === 0) return;

    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const todayBirthdays: string[] = [];
    const weekBirthdays: { name: string; date: string }[] = [];

    students.forEach(s => {
      const bd = parseBirthDate(s.birth_date ?? null);
      if (!bd) return;

      if (bd.day === todayDay && bd.month === todayMonth) {
        todayBirthdays.push(s.full_name || 'Sem nome');
      } else {
        // Check if birthday falls within this week
        const thisYearBday = new Date(today.getFullYear(), bd.month - 1, bd.day);
        if (thisYearBday >= startOfWeek && thisYearBday <= endOfWeek) {
          weekBirthdays.push({
            name: s.full_name || 'Sem nome',
            date: `${String(bd.day).padStart(2, '0')}/${String(bd.month).padStart(2, '0')}`,
          });
        }
      }
    });

    if (todayBirthdays.length > 0) {
      toast.info(`🎂 Aniversariante(s) de hoje: ${todayBirthdays.join(', ')}`, {
        duration: 8000,
      });
    }

    if (weekBirthdays.length > 0) {
      const list = weekBirthdays.map(b => `${b.name} (${b.date})`).join(', ');
      toast.info(`🎉 Aniversariante(s) da semana: ${list}`, {
        duration: 8000,
      });
    }
  }, [students]);

  return null;
}
