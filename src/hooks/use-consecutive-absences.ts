import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { useStudents, useStudentSchedules } from '@/hooks/use-supabase-data';

export interface ConsecutiveAbsenceRow {
  studentId: string;
  name: string;
  photo_url: string | null;
  phone: string | null;
  birth_date: string | null;
  courses: string[];
  status: string | null;
  schedule: string;
  days: string[];
  times: string[];
  startDate: string | null;
  expectedEndDate: string | null;
  streak: number;
  lastPresentDate: string | null;
  lastAbsentDate: string | null;
  totalPresent: number;
  totalAbsent: number;
  attendancePct: number;
  observations: string[];
}

const DAY_ORDER: Record<string, number> = {
  segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};
const DAY_LABEL: Record<string, string> = {
  segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta',
  quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado',
};
const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
};
const fmt = (d: Date | null) =>
  d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : null;

export function useConsecutiveAbsences(minStreak = 2) {
  const { schoolId } = useSchool();
  const { data: students } = useStudents(true);
  const { data: schedules } = useStudentSchedules();

  const studentIds = useMemo(
    () => (students ?? []).map((s: any) => s.id),
    [students]
  );

  const { data: attendance } = useQuery({
    queryKey: ['attendance_for_consecutive', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, date, status')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .in('status', ['present', 'absent'])
        .order('date', { ascending: true })
        .limit(20000);
      return data ?? [];
    },
  });

  const { data: observations } = useQuery({
    queryKey: ['observations_for_consecutive', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_observations')
        .select('student_id, observation')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  return useMemo<ConsecutiveAbsenceRow[]>(() => {
    if (!students || !attendance) return [];

    const schedByStudent: Record<string, any[]> = {};
    (schedules ?? []).forEach((sch: any) => {
      const sid = sch.student_id;
      if (!sid) return;
      if (!schedByStudent[sid]) schedByStudent[sid] = [];
      schedByStudent[sid].push(sch);
    });

    const obsByStudent: Record<string, string[]> = {};
    (observations ?? []).forEach((o: any) => {
      if (!obsByStudent[o.student_id]) obsByStudent[o.student_id] = [];
      obsByStudent[o.student_id].push(o.observation);
    });

    // Group attendance per student
    const attByStudent: Record<string, { date: string; status: string }[]> = {};
    (attendance as any[]).forEach(a => {
      if (!attByStudent[a.student_id]) attByStudent[a.student_id] = [];
      attByStudent[a.student_id].push({ date: a.date, status: a.status });
    });

    const out: ConsecutiveAbsenceRow[] = [];

    (students as any[]).forEach(s => {
      const att = attByStudent[s.id] ?? [];
      if (att.length === 0) return;

      // Count trailing absence streak
      let streak = 0;
      let lastPresent: string | null = null;
      let lastAbsent: string | null = null;
      let totalPresent = 0;
      let totalAbsent = 0;
      for (let i = att.length - 1; i >= 0; i--) {
        const r = att[i];
        if (r.status === 'present') {
          if (!lastPresent) lastPresent = r.date;
        } else if (r.status === 'absent') {
          if (!lastAbsent) lastAbsent = r.date;
        }
      }
      // walking from the end (latest) for streak
      for (let i = att.length - 1; i >= 0; i--) {
        if (att[i].status === 'absent') streak += 1;
        else break;
      }
      att.forEach(r => {
        if (r.status === 'present') totalPresent += 1;
        else if (r.status === 'absent') totalAbsent += 1;
      });

      if (streak < minStreak) return;

      // Build schedule info
      const slots = (schedByStudent[s.id] ?? []).map((sch: any) => sch.time_slots).filter(Boolean);
      const ordered = slots
        .map((ts: any) => ({
          day: norm(ts.day_of_week),
          dayLabel: DAY_LABEL[norm(ts.day_of_week)] || ts.day_of_week,
          start: ts.start_time?.slice(0, 5),
          end: ts.end_time?.slice(0, 5),
          order: DAY_ORDER[norm(ts.day_of_week)] ?? 99,
        }))
        .sort((a: any, b: any) => a.order - b.order);

      const days = Array.from(new Set(ordered.map((o: any) => o.dayLabel)));
      const times = Array.from(new Set(ordered.map((o: any) => `${o.start}-${o.end}`)));
      const schedule = ordered
        .map((o: any) => `${o.dayLabel} ${o.start}-${o.end}`)
        .join(', ');

      const activeCourses = (s.student_courses ?? []).filter((sc: any) => sc.is_active);
      const courses = activeCourses.map((sc: any) => sc.courses?.name || sc.custom_course_name || 'N/A');

      // earliest start, latest expected end — use first_class_date/enrollment_date
      let startDate: Date | null = null;
      let expectedEnd: Date | null = null;
      activeCourses.forEach((sc: any) => {
        const d = parseDate(sc.first_class_date || sc.enrollment_date);
        if (d && (!startDate || d < startDate)) startDate = d;
      });

      const total = totalPresent + totalAbsent;
      const pct = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

      const status = activeCourses[0]?.status || null;

      out.push({
        studentId: s.id,
        name: s.full_name || 'Sem nome',
        photo_url: s.photo_url ?? null,
        phone: s.guardian_phone ?? null,
        birth_date: s.birth_date ?? null,
        courses,
        status,
        schedule,
        days,
        times,
        startDate: fmt(startDate),
        expectedEndDate: fmt(expectedEnd),
        streak,
        lastPresentDate: lastPresent ? fmt(parseDate(lastPresent)) : null,
        lastAbsentDate: lastAbsent ? fmt(parseDate(lastAbsent)) : null,
        totalPresent,
        totalAbsent,
        attendancePct: pct,
        observations: obsByStudent[s.id] ?? [],
      });
    });

    return out.sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));
  }, [students, schedules, attendance, observations, minStreak]);
}
