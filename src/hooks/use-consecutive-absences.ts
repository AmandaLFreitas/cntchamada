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
// JS getDay() -> our key (0=Sun,1=Mon...)
const DOW_TO_KEY: Record<number, string> = {
  1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado',
};

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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

// ---- Holidays & breaks ---------------------------------------------------
const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [12, 25],
];
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function addDays(d: Date, days: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + days); return r;
}
function getHolidaySet(fromY: number, toY: number): Set<string> {
  const set = new Set<string>();
  for (let y = fromY; y <= toY; y++) {
    FIXED_HOLIDAYS.forEach(([m, d]) => set.add(ymd(new Date(y, m - 1, d))));
    const easter = easterSunday(y);
    set.add(ymd(addDays(easter, -48)));
    set.add(ymd(addDays(easter, -47)));
    set.add(ymd(addDays(easter, -2)));
    set.add(ymd(addDays(easter, 60)));
  }
  return set;
}
function isOnBreak(d: Date): boolean {
  const m = d.getMonth() + 1, day = d.getDate();
  if (m === 7 && day >= 1 && day <= 14) return true;
  if (m === 12 && day >= 13) return true;
  if (m === 1 && day <= 14) return true;
  return false;
}

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
      const { data } = await supabase
        .from('attendance')
        .select('student_id, time_slot_id, date, status')
        .eq('school_id', schoolId!)
        .in('student_id', studentIds)
        .order('date', { ascending: true })
        .limit(20000);
      return data ?? [];
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    // Attendance keyed by student -> "date|slotId" -> status, and by date alone for totals
    const attByStudent: Record<string, Map<string, string>> = {};
    const attDatesByStudent: Record<string, { date: string; status: string }[]> = {};
    (attendance as any[]).forEach(a => {
      if (!attByStudent[a.student_id]) attByStudent[a.student_id] = new Map();
      attByStudent[a.student_id].set(`${a.date}|${a.time_slot_id || ''}`, a.status);
      if (!attDatesByStudent[a.student_id]) attDatesByStudent[a.student_id] = [];
      attDatesByStudent[a.student_id].push({ date: a.date, status: a.status });
    });

    // Precompute holidays spanning relevant years
    const holidayCache = new Map<string, Set<string>>();
    const getHolidays = (fromY: number, toY: number) => {
      const key = `${fromY}-${toY}`;
      let s = holidayCache.get(key);
      if (!s) { s = getHolidaySet(fromY, toY); holidayCache.set(key, s); }
      return s;
    };

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
      if (startDate > today) return; // hasn't started

      const holidays = getHolidays(startDate.getFullYear(), today.getFullYear() + 1);

      // Build set of dowNum -> slots[]
      const slotsByDow: Record<number, typeof slots> = {};
      slots.forEach(sl => {
        if (!slotsByDow[sl.dowNum]) slotsByDow[sl.dowNum] = [];
        slotsByDow[sl.dowNum].push(sl);
      });

      // Walk dates from today backwards to startDate, on each predicted class:
      // - skip holidays/breaks
      // - for each slot of that day, check status; multiple slots same date treated together
      // Per spec: present/neutral -> stop streak immediately; absent or missing(past) -> +1
      const attMap = attByStudent[s.id] ?? new Map<string, string>();

      let streak = 0;
      let firstAbsentInStreak: string | null = null;
      let lastAbsentInStreak: string | null = null;
      let stopped = false;

      const cursor = new Date(today);
      while (!stopped && cursor >= startDate) {
        const dow = cursor.getDay();
        const key = DOW_TO_KEY[dow];
        const daySlots = key ? slotsByDow[DAY_ORDER[key]] : undefined;
        const dateStr = ymd(cursor);

        if (daySlots && daySlots.length > 0 && !isOnBreak(cursor) && !holidays.has(dateStr)) {
          // For this predicted day, examine each slot's status
          let dayHasBreaker = false;
          let dayHasAbsent = false;
          for (const sl of daySlots) {
            const st = attMap.get(`${dateStr}|${sl.slotId}`);
            if (st === 'present' || st === 'neutral') {
              dayHasBreaker = true;
              break;
            }
            if (st === 'absent') {
              dayHasAbsent = true;
            } else if (!st) {
              // Missing record: only counts as absent if date already passed (date < today)
              if (cursor < today) dayHasAbsent = true;
            }
          }
          if (dayHasBreaker) {
            stopped = true;
          } else if (dayHasAbsent) {
            streak += 1;
            if (!lastAbsentInStreak) lastAbsentInStreak = dateStr;
            firstAbsentInStreak = dateStr;
          }
          // if nothing for today (today with no record), neither break nor count — keep walking
        }

        cursor.setDate(cursor.getDate() - 1);
      }

      // Totals (real registered) + last present/absent
      const allRecs = (attDatesByStudent[s.id] ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
      let totalPresent = 0, totalAbsent = 0;
      let lastPresent: string | null = null;
      let lastAbsent: string | null = null;
      allRecs.forEach(r => {
        if (r.status === 'present') totalPresent += 1;
        else if (r.status === 'absent') totalAbsent += 1;
      });
      for (let i = allRecs.length - 1; i >= 0; i--) {
        if (!lastPresent && allRecs[i].status === 'present') lastPresent = allRecs[i].date;
        if (!lastAbsent && allRecs[i].status === 'absent') lastAbsent = allRecs[i].date;
        if (lastPresent && lastAbsent) break;
      }

      if (streak < minStreak) return;

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
        phone: s.guardian_phone ?? null,
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
