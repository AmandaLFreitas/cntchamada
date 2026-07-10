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
  firstAbsentInStreakDate: string | null;
  firstAbsentInStreakISO: string | null;
  lastAbsentInStreakISO: string | null;
  lastPresentDate: string | null;
  lastAbsentDate: string | null;
  totalPresent: number;
  totalAbsent: number;
  attendancePct: number;
  observations: string[];
  streakJustified: boolean;
  streakNote: string;
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

const pad = (n: number) => String(n).padStart(2, '0');

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
  d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : null;

export function useConsecutiveAbsences(minStreak = 2) {
  const { schoolId } = useSchool();
  const { data: students } = useStudents(true);
  const { data: schedules } = useStudentSchedules();

  const studentIds = useMemo(
    () => (students ?? []).map((s: any) => s.id),
    [students]
  );

  const queryClient = useQueryClient();

  const { data: attendance } = useQuery({
    queryKey: ['attendance_for_consecutive', schoolId, studentIds],
    enabled: !!schoolId && studentIds.length > 0,
    queryFn: async () => {
      const pageSize = 1000;
      const allRows: any[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('attendance')
          .select('student_id, time_slot_id, date, status, is_justified, absence_note, time_slots(start_time)')
          .eq('school_id', schoolId!)
          .in('student_id', studentIds)
          .order('date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        allRows.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      return allRows;
    },
  });

  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`attendance-consecutive-${schoolId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `school_id=eq.${schoolId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['attendance_for_consecutive', schoolId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [schoolId, queryClient]);

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
    if (!students || !attendance || !schedules) return [];

    // Group schedules per student: list of { dowKey, dowNum, slotId, start, end }
    const schedByStudent: Record<string, Array<{
      dowKey: string; dowNum: number; slotId: string; start: string; end: string;
    }>> = {};
    (schedules ?? []).forEach((sch: any) => {
      const sid = sch.student_id;
      const ts = sch.time_slots;
      if (!sid || !ts) return;
      const dowKey = norm(ts.day_of_week);
      const dowNum = DAY_ORDER[dowKey];
      if (!dowNum) return;
      if (!schedByStudent[sid]) schedByStudent[sid] = [];
      schedByStudent[sid].push({
        dowKey,
        dowNum,
        slotId: ts.id,
        start: (ts.start_time || '').slice(0, 5),
        end: (ts.end_time || '').slice(0, 5),
      });
    });

    const obsByStudent: Record<string, string[]> = {};
    (observations ?? []).forEach((o: any) => {
      if (!obsByStudent[o.student_id]) obsByStudent[o.student_id] = [];
      obsByStudent[o.student_id].push(o.observation);
    });

      // Use only real attendance rows. Missing dates/classes are ignored completely.
      // Group by DATE: a day counts as at most one absence regardless of number of classes.
      const attDatesByStudent: Record<string, { date: string; status: 'present' | 'absent' | 'neutral' }[]> = {};
      const rawByStudent: Record<string, any[]> = {};
      (attendance as any[]).forEach(a => {
        if (!rawByStudent[a.student_id]) rawByStudent[a.student_id] = [];
        rawByStudent[a.student_id].push(a);
      });
      Object.entries(rawByStudent).forEach(([sid, rows]) => {
        const byDate = new Map<string, { hasPresent: boolean; hasAbsent: boolean }>();
        rows.forEach((r: any) => {
          const cur = byDate.get(r.date) || { hasPresent: false, hasAbsent: false };
          if (r.status === 'present') cur.hasPresent = true;
          else if (r.status === 'absent') cur.hasAbsent = true;
          byDate.set(r.date, cur);
        });
        attDatesByStudent[sid] = Array.from(byDate.entries()).map(([date, v]) => ({
          date,
          status: v.hasPresent ? 'present' : v.hasAbsent ? 'absent' : 'neutral',
        }));
      });

    const out: ConsecutiveAbsenceRow[] = [];

    (students as any[]).forEach(s => {
      const slots = schedByStudent[s.id] ?? [];
      if (slots.length === 0) return;

      const activeCourses = (s.student_courses ?? []).filter((sc: any) => sc.is_active);
      if (activeCourses.length === 0) return;

      // Determine start date: earliest first_class_date/enrollment_date
      let startDate: Date | null = null;
      activeCourses.forEach((sc: any) => {
        const d = parseDate(sc.first_class_date || sc.enrollment_date);
        if (d && (!startDate || d < startDate)) startDate = d;
      });
      if (!startDate) return;

      let streak = 0;
      let firstAbsentInStreak: string | null = null;
      let lastAbsentInStreak: string | null = null;

      const allRecs = (attDatesByStudent[s.id] ?? [])
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date));

      for (const rec of allRecs) {
        if (rec.status === 'absent') {
          streak += 1;
          if (!lastAbsentInStreak) lastAbsentInStreak = rec.date;
          firstAbsentInStreak = rec.date;
          continue;
        }
        if (rec.status === 'present' || rec.status === 'neutral') break;
      }

      // Totals (per day) + last present/absent
      const ascendingRecs = allRecs.slice().sort((a, b) => a.date.localeCompare(b.date));

      let totalPresent = 0, totalAbsent = 0;
      let lastPresent: string | null = null;
      let lastAbsent: string | null = null;
      ascendingRecs.forEach(r => {
        if (r.status === 'present') totalPresent += 1;
        else if (r.status === 'absent') totalAbsent += 1;
      });
      for (let i = ascendingRecs.length - 1; i >= 0; i--) {
        if (!lastPresent && ascendingRecs[i].status === 'present') lastPresent = ascendingRecs[i].date;
        if (!lastAbsent && ascendingRecs[i].status === 'absent') lastAbsent = ascendingRecs[i].date;
        if (lastPresent && lastAbsent) break;
      }

      if (streak < minStreak) return;

      // Aggregate justified/note from raw rows within the streak window
      let streakJustified = false;
      let streakNote = '';
      if (firstAbsentInStreak && lastAbsentInStreak) {
        const streakRaws = (rawByStudent[s.id] ?? []).filter((r: any) =>
          r.status === 'absent' &&
          r.date >= firstAbsentInStreak! &&
          r.date <= lastAbsentInStreak!
        );
        streakJustified = streakRaws.some((r: any) => !!r.is_justified);
        const note = streakRaws.map((r: any) => (r.absence_note || '').trim()).find((n: string) => n);
        streakNote = note || '';
      }

      // Schedule display
      const ordered = slots
        .map(sl => ({ ...sl, dayLabel: DAY_LABEL[sl.dowKey] || sl.dowKey }))
        .sort((a, b) => a.dowNum - b.dowNum || a.start.localeCompare(b.start));
      const days = Array.from(new Set(ordered.map(o => o.dayLabel)));
      const times = Array.from(new Set(ordered.map(o => `${o.start}-${o.end}`)));
      const schedule = ordered.map(o => `${o.dayLabel} ${o.start}-${o.end}`).join(', ');

      const courses = activeCourses.map((sc: any) => sc.courses?.name || sc.custom_course_name || 'N/A');
      const total = totalPresent + totalAbsent;
      const pct = total > 0 ? Math.round((totalPresent / total) * 100) : 0;
      const status = activeCourses[0]?.status || null;

      out.push({
        studentId: s.id,
        name: s.full_name || 'Sem nome',
        photo_url: s.photo_url ?? null,
        phone: (s as any).phone ?? s.guardian_phone ?? null,
        birth_date: s.birth_date ?? null,
        courses,
        status,
        schedule,
        days,
        times,
        startDate: fmt(startDate),
        expectedEndDate: null,
        streak,
        firstAbsentInStreakDate: firstAbsentInStreak ? fmt(parseDate(firstAbsentInStreak)) : null,
        firstAbsentInStreakISO: firstAbsentInStreak,
        lastAbsentInStreakISO: lastAbsentInStreak,
        lastPresentDate: lastPresent ? fmt(parseDate(lastPresent)) : null,
        lastAbsentDate: lastAbsent ? fmt(parseDate(lastAbsent)) : null,
        totalPresent,
        totalAbsent,
        attendancePct: pct,
        observations: obsByStudent[s.id] ?? [],
        streakJustified,
        streakNote,
      });
    });

    return out.sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));
  }, [students, schedules, attendance, observations, minStreak]);
}
