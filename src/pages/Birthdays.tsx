import { useMemo, useState } from 'react';
import { useStudents, useCourses } from '@/hooks/use-supabase-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cake } from 'lucide-react';

function parseBirthDate(dateStr: string | null): { day: number; month: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) return { day: parseInt(parts[0]), month: parseInt(parts[1]) };
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return { day: d.getDate(), month: d.getMonth() + 1 };
  return null;
}

interface BirthdayStudent {
  id: string;
  name: string;
  birth_date: string;
  course: string;
  dateLabel: string;
}

export default function Birthdays() {
  const { data: students } = useStudents();
  const { data: courses } = useCourses();

  const courseLookup = useMemo(() => {
    const map: Record<string, string> = {};
    courses?.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [courses]);

  const { today, week, month } = useMemo(() => {
    const today: BirthdayStudent[] = [];
    const week: BirthdayStudent[] = [];
    const month: BirthdayStudent[] = [];
    if (!students?.length) return { today, week, month };

    const now = new Date();
    const td = now.getDate(), tm = now.getMonth() + 1;
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);

    students.forEach(s => {
      const bd = parseBirthDate(s.birth_date ?? null);
      if (!bd) return;
      const courseName = (s.course_id ? courseLookup[s.course_id] : null) || s.custom_course_name || 'Sem curso';
      const dateLabel = `${String(bd.day).padStart(2, '0')}/${String(bd.month).padStart(2, '0')}`;
      const entry: BirthdayStudent = { id: s.id, name: s.full_name || 'Sem nome', birth_date: s.birth_date || '', course: courseName, dateLabel };

      if (bd.day === td && bd.month === tm) {
        today.push(entry);
      }

      const bday = new Date(now.getFullYear(), bd.month - 1, bd.day);
      if (bday >= startOfWeek && bday <= endOfWeek) {
        week.push(entry);
      }

      if (bd.month === tm) {
        month.push(entry);
      }
    });

    month.sort((a, b) => {
      const da = parseBirthDate(a.birth_date);
      const db = parseBirthDate(b.birth_date);
      return (da?.day || 0) - (db?.day || 0);
    });

    return { today, week, month };
  }, [students, courseLookup]);

  const renderList = (list: BirthdayStudent[], emptyMsg: string) => (
    list.length === 0 ? (
      <p className="text-muted-foreground text-center py-8">{emptyMsg}</p>
    ) : (
      <div className="grid gap-3">
        {list.map(s => (
          <div key={s.id} className="bg-card border rounded-lg p-4 flex items-center gap-4">
            <div className="bg-amber-100 text-amber-700 rounded-full p-2">
              <Cake className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.course}</p>
            </div>
            <span className="text-sm font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">{s.dateLabel}</span>
          </div>
        ))}
      </div>
    )
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Aniversariantes</h1>
      <Tabs defaultValue="today">
        <TabsList className="mb-4">
          <TabsTrigger value="today">
            Hoje {today.length > 0 && <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5">{today.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="week">
            Semana {week.length > 0 && <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5">{week.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="month">
            Mês {month.length > 0 && <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5">{month.length}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today">{renderList(today, 'Nenhum aniversariante hoje.')}</TabsContent>
        <TabsContent value="week">{renderList(week, 'Nenhum aniversariante esta semana.')}</TabsContent>
        <TabsContent value="month">{renderList(month, 'Nenhum aniversariante este mês.')}</TabsContent>
      </Tabs>
    </div>
  );
}
