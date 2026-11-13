// Interpreta abreviações escritas à mão nas fichas de matrícula.

const strip = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9/+ ]/g, ' ').replace(/\s+/g, ' ').trim();

// Ordem importa: regras mais específicas primeiro. Valor = nome oficial do curso.
const COURSE_RULES: [RegExp, string][] = [
  [/\bscratch\b/, 'Programação KIDS - SCRATCH'],
  [/\bjava\b|\blogica\b/, 'Lógica de Programação - JAVA'],
  [/\bhtml\b|\bcss\b/, 'Programação - HTML/CSS'],
  [/\bpower ?bi\b|^bi$|\bp ?bi\b/, 'Power - BI'],
  [/\baux(iliar)? ?cont/, 'Auxiliar contabil'],
  [/\baux(iliar)? ?adm/, 'Auxiliar administrativo'],
  [/\binf(o|ormatica)? ?adm|\badministrativa\b/, 'Informática Administrativa'],
  [/\bsketch/, 'Sketchup arquitetonico'],
  [/\bsolid/, 'Solidworks projetos'],
  [/\b(auto ?)?cad\b|\bautocad/, 'Autocad projetos'],
  [/\bexcel\b/, 'Excel avançado'],
  [/\bdesign\b|\bgrafico\b/, 'Design grafico'],
  [/\bbasica\b|\bbasico\b|\bkids\b|\binf(o|ormatica)?\b/, 'Informática básica'],
];

export function resolveCourseName<T extends { id: string; name: string }>(raw: string, courses: T[]): T | undefined {
  const s = strip(raw);
  if (!s) return undefined;
  const exact = courses.find(c => strip(c.name) === s);
  if (exact) return exact;
  for (const [re, official] of COURSE_RULES) {
    if (re.test(s)) {
      const c = courses.find(x => strip(x.name) === strip(official));
      if (c) return c;
    }
  }
  return courses.find(c => strip(c.name).includes(s) || s.includes(strip(c.name)));
}

const DAY_TOKENS: [RegExp, string][] = [
  [/^seg/, 'Segunda'], [/^ter/, 'Terça'], [/^qua/, 'Quarta'],
  [/^qui/, 'Quinta'], [/^sex/, 'Sexta'], [/^sab/, 'Sábado'],
];

function toMinutes(h: number, m: number) { return h * 60 + m; }
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }

function parseHour(t: string): number | null {
  const m = t.match(/^(\d{1,2})(?:[:h.](\d{2}))?h?$/);
  if (!m) return null;
  let h = Number(m[1]); const min = m[2] ? Number(m[2]) : 0;
  if (h < 7) h += 12; // "2-4" escrito à tarde
  if (h > 23 || min > 59) return null;
  return toMinutes(h, min);
}

export interface ParsedSchedule { day: string; start: string; end: string }

/** Ex.: "Sab(10-12)", "Seg/Qua 14:30-16:30", "Ter e Qui (8-10)". */
export function parseScheduleText(text: string): ParsedSchedule[] {
  const norm = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tokens = norm.match(/\d{1,2}(?:[:h.]\d{2})?h?\s*(?:-|as|a|ate|–)\s*\d{1,2}(?:[:h.]\d{2})?h?|[a-z]+/g) ?? [];
  const out: ParsedSchedule[] = [];
  let pending: string[] = [];
  let lastDays: string[] = [];
  for (const tok of tokens) {
    const day = DAY_TOKENS.find(([re]) => re.test(tok))?.[1];
    if (day && /^[a-z]+$/.test(tok)) { if (!pending.includes(day)) pending.push(day); continue; }
    const r = tok.match(/^(\S+?)\s*(?:-|as|a|ate|–)\s*(\S+)$/);
    if (!r || !/\d/.test(tok)) continue;
    const s = parseHour(r[1]); let e = parseHour(r[2]);
    if (s == null || e == null) continue;
    if (e <= s && e + 720 > s) e += 720;
    if (e <= s) continue;
    const days = pending.length ? pending : lastDays;
    days.forEach(d => out.push({ day: d, start: hhmm(s), end: hhmm(e!) }));
    lastDays = days; pending = [];
  }
  return out;
}

/** Converte faixas em chaves de horários existentes (slots de 1h) por dia. */
export function scheduleToDayKeys(
  parsed: ParsedSchedule[],
  slots: { day_of_week: string; start_time: string; end_time: string }[],
): Record<string, string[]> {
  const res: Record<string, string[]> = {};
  for (const p of parsed) {
    slots
      .filter(s => s.day_of_week === p.day && s.start_time >= p.start && s.end_time <= p.end)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .forEach(s => {
        const key = `${s.start_time}-${s.end_time}`;
        (res[p.day] ??= []);
        if (!res[p.day].includes(key)) res[p.day].push(key);
      });
  }
  return res;
}
