// Calendar breaks: holidays and vacation periods that should NOT count as class days.

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Brazilian fixed national holidays (month is 1-based here for readability)
const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1],   // Confraternização Universal
  [4, 21],  // Tiradentes
  [5, 1],   // Dia do Trabalho
  [9, 7],   // Independência
  [10, 12], // Nossa Senhora Aparecida
  [11, 2],  // Finados
  [11, 15], // Proclamação da República
  [12, 25], // Natal
];

// Easter calculation (Meeus/Jones/Butcher) — used for Carnival, Good Friday, Corpus Christi
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Returns set of YYYY-MM-DD holiday dates spanning the years involved. */
function getHolidaySet(fromYear: number, toYear: number): Set<string> {
  const set = new Set<string>();
  for (let y = fromYear; y <= toYear; y++) {
    FIXED_HOLIDAYS.forEach(([m, d]) => set.add(ymd(new Date(y, m - 1, d))));
    const easter = easterSunday(y);
    set.add(ymd(addDays(easter, -48))); // Carnival Monday
    set.add(ymd(addDays(easter, -47))); // Carnival Tuesday
    set.add(ymd(addDays(easter, -2)));  // Good Friday
    set.add(ymd(addDays(easter, 60)));  // Corpus Christi
  }
  return set;
}

/**
 * Determines if a given date falls in a vacation/break period:
 *  - July break: first 2 full weeks of July (Jul 1 → Jul 14)
 *  - Year-end break: Dec 13 → Jan 14 of next year
 */
function isOnBreak(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // July break (2 weeks)
  if (m === 7 && day >= 1 && day <= 14) return true;
  // Year-end: Dec 13–31
  if (m === 12 && day >= 13) return true;
  // Year-start: Jan 1–14
  if (m === 1 && day <= 14) return true;
  return false;
}

/**
 * Counts effective weeks between start and end, subtracting break periods and
 * weeks where holidays would have removed a class day. Returns a fractional
 * number of weeks (>= 0).
 *
 * To keep the math simple and predictable we work in days:
 *  effectiveDays = totalDays - breakDays - holidayCount(non-break, weekday)
 *  effectiveWeeks = effectiveDays / 7
 */
export function effectiveWeeksBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  const fromY = start.getFullYear();
  const toY = end.getFullYear();
  const holidays = getHolidaySet(fromY, toY);

  let totalDays = 0;
  let breakDays = 0;
  let holidayDays = 0;

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);

  while (cursor < endNorm) {
    totalDays++;
    if (isOnBreak(cursor)) {
      breakDays++;
    } else if (holidays.has(ymd(cursor))) {
      // Only count weekday holidays (class days) as lost days
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 6) holidayDays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const effectiveDays = Math.max(totalDays - breakDays - holidayDays, 0);
  return effectiveDays / 7;
}

/**
 * Adds an effective number of weeks to a start date, skipping break periods
 * and holiday days. Returns the resulting calendar date.
 */
export function addEffectiveWeeks(start: Date, weeks: number): Date {
  if (weeks <= 0) return new Date(start);
  const targetDays = Math.ceil(weeks * 7);
  const fromY = start.getFullYear();
  // Pre-compute holidays for a generous window (start year .. start+3 years)
  const holidays = getHolidaySet(fromY, fromY + 3);

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  let counted = 0;
  // Safety cap to avoid infinite loop (5 years)
  const cap = 365 * 5;
  let safety = 0;
  while (counted < targetDays && safety < cap) {
    cursor.setDate(cursor.getDate() + 1);
    safety++;
    if (isOnBreak(cursor)) continue;
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 6 && holidays.has(ymd(cursor))) continue;
    counted++;
  }
  return cursor;
}
