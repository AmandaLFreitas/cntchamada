import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { useSaveAttendance } from './use-supabase-data';

const state = vi.hoisted(() => ({ existing: null as null | { id: string; student_course_id: string | null }, insert: vi.fn() }));
vi.mock('@/contexts/SchoolContext', () => ({ useSchool: () => ({ schoolId: 'toledo' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => {
    const read = { eq: () => read, maybeSingle: async () => ({ data: state.existing, error: null }) };
    return { select: () => read, insert: (payload: unknown) => {
      state.insert(payload);
      return { select: async () => ({ data: [payload], error: null }) };
    } };
  },
} }));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useSaveAttendance(), { wrapper });
}
const input = { studentId: 'student', studentCourseId: 'new', timeSlotId: 'slot', date: '2026-11-05', status: 'present' };

describe('Attendance attribution', () => {
  beforeEach(() => { state.existing = null; state.insert.mockClear(); });
  it('saves the exact enrollment selected in the call and school', async () => {
    const { result } = setup();
    await act(async () => { await result.current.mutateAsync(input); });
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ student_course_id: 'new', student_id: 'student', school_id: 'toledo' }));
  });
  it('preserves unlinked historical presence instead of transferring it to a new course', async () => {
    state.existing = { id: 'legacy', student_course_id: null };
    const { result } = setup();
    await act(async () => { await expect(result.current.mutateAsync(input)).rejects.toThrow('preservado'); });
    expect(state.insert).not.toHaveBeenCalled();
  });
  it('never replaces the presence of a previous enrollment', async () => {
    state.existing = { id: 'previous', student_course_id: 'old' };
    const { result } = setup();
    await act(async () => { await expect(result.current.mutateAsync(input)).rejects.toThrow('preservado'); });
    expect(state.insert).not.toHaveBeenCalled();
  });
});