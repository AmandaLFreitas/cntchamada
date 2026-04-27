import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents, useStudentSchedules } from '@/hooks/use-supabase-data';
import { GraduationCap } from 'lucide-react';

const VANDERLEI_COURSES = [
  'Excel Avançado',
  'Solid',
  'AutoCAD',
  'Sketch',
  'Power BI',
  'Design Gráfico',
];

const normalize = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const VANDERLEI_NORM = VANDERLEI_COURSES.map(normalize);

const isVanderleiCourse = (name: string | null | undefined) => {
  if (!name) return false;
  const n = normalize(name);
  return VANDERLEI_NORM.some(v => n === v || n.includes(v));
};

const DAY_ORDER: Record<string, number> = {
  'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6,
};

const DAY_LABEL: Record<string, string> = {
  'segunda': 'Segunda', 'terca': 'Terça', 'quarta': 'Quarta',
  'quinta': 'Quinta', 'sexta': 'Sexta', 'sabado': 'Sábado',
};

export default function Vanderlei() {
  const { data: students } = useStudents(true);
  const { data: schedules } = useStudentSchedules();

  const rows = useMemo(() => {
    if (!students) return [];
    const schedByCourseId: Record<string, any[]> = {};
    (schedules ?? []).forEach((sch: any) => {
      const scId = sch.student_course_id;
      if (!scId) return;
      if (!schedByCourseId[scId]) schedByCourseId[scId] = [];
      schedByCourseId[scId].push(sch);
    });

    const result: { key: string; name: string; course: string; schedule: string }[] = [];

    (students as any[]).forEach(s => {
      (s.student_courses ?? []).forEach((sc: any) => {
        if (!sc.is_active) return;
        const courseName = sc.courses?.name || sc.custom_course_name || '';
        if (!isVanderleiCourse(courseName)) return;

        const slots = schedByCourseId[sc.id] || [];
        const scheduleStr = slots.length === 0
          ? '—'
          : slots
              .map((sch: any) => {
                const ts = sch.time_slots;
                if (!ts) return null;
                return {
                  day: ts.day_of_week,
                  order: DAY_ORDER[normalize(ts.day_of_week)] ?? 99,
                  text: `${DAY_LABEL[normalize(ts.day_of_week)] || ts.day_of_week} ${ts.start_time?.slice(0, 5)}-${ts.end_time?.slice(0, 5)}`,
                };
              })
              .filter(Boolean)
              .sort((a: any, b: any) => a.order - b.order)
              .map((x: any) => x.text)
              .join(', ');

        result.push({
          key: `${s.id}-${sc.id}`,
          name: s.full_name || 'Sem nome',
          course: courseName,
          schedule: scheduleStr,
        });
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [students, schedules]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Alunos do Professor Vanderlei</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Lista automática de alunos matriculados nos cursos: {VANDERLEI_COURSES.join(', ')}.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Nenhum aluno matriculado nesses cursos.
        </p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Completo</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Horário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.course}</TableCell>
                  <TableCell className="text-sm">{r.schedule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-right">
        Total: <span className="font-semibold">{rows.length}</span> aluno(s)
      </p>
    </div>
  );
}
