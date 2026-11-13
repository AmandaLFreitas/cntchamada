import { describe, it, expect } from 'vitest';
import { resolveCourseName, parseScheduleText, scheduleToDayKeys } from './enrollment-form-parse';

const courses = ['Autocad projetos','Excel avançado','Informática Administrativa','Informática básica','Programação KIDS - SCRATCH']
  .map((name, i) => ({ id: String(i), name }));

describe('resolveCourseName', () => {
  it.each([
    ['Inf.ADM', 'Informática Administrativa'],
    ['básica', 'Informática básica'],
    ['KIDS', 'Informática básica'],
    ['CAD', 'Autocad projetos'],
    ['Excel', 'Excel avançado'],
  ])('%s -> %s', (raw, name) => expect(resolveCourseName(raw, courses)?.name).toBe(name));
});

describe('parseScheduleText', () => {
  it('Sab(10-12) is Saturday 10:00-12:00', () => {
    expect(parseScheduleText('Sab(10-12)')).toEqual([{ day: 'Sábado', start: '10:00', end: '12:00' }]);
  });
  it('Seg/Qua 14:30-16:30 applies to both days', () => {
    expect(parseScheduleText('Seg/Qua 14:30-16:30').map(p => p.day)).toEqual(['Segunda', 'Quarta']);
  });
  it('maps ranges into 1-hour slots', () => {
    const slots = [{ day_of_week: 'Sábado', start_time: '10:00', end_time: '11:00' }, { day_of_week: 'Sábado', start_time: '11:00', end_time: '12:00' }];
    expect(scheduleToDayKeys(parseScheduleText('Sab(10-12)'), slots)).toEqual({ 'Sábado': ['10:00-11:00', '11:00-12:00'] });
  });
});
