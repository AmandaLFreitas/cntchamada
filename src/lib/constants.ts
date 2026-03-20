export const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sábado'] as const;

export const TIME_SLOTS = [
  { start: '08:00', end: '09:00', label: '08:00 - 09:00' },
  { start: '09:00', end: '10:00', label: '09:00 - 10:00' },
  { start: '10:00', end: '11:00', label: '10:00 - 11:00' },
  { start: '13:30', end: '14:30', label: '13:30 - 14:30' },
  { start: '14:30', end: '15:30', label: '14:30 - 15:30' },
  { start: '15:30', end: '16:30', label: '15:30 - 16:30' },
  { start: '16:30', end: '17:30', label: '16:30 - 17:30' },
] as const;

export const SATURDAY_SLOTS = [
  { start: '08:00', end: '10:00', label: '08:00 - 10:00' },
  { start: '10:00', end: '12:00', label: '10:00 - 12:00' },
] as const;

export const MAX_STUDENTS_PER_SLOT = 20;

export function getSlotsForDay(day: string) {
  return day === 'Sábado' ? SATURDAY_SLOTS : TIME_SLOTS;
}

export function getTodayDayName(): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const today = new Date().getDay();
  const name = days[today];
  if (name === 'Domingo' || name === 'Sexta') return 'Segunda';
  return name;
}
