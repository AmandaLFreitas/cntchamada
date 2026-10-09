import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useReportData, useUpdateStudent } from './use-supabase-data';

const state = vi.hoisted(() => ({ status: 'em_andamento' }));
vi.mock('@/contexts/SchoolContext', () => ({ useSchool: () => ({ schoolId: 'toledo' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({
    select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: [{
      id: 'course-1', student_id: 'student-1', school_id: 'toledo', status: state.status,
      workload: 48, courses: { name: 'Curso real' },
      students: { id: 'student-1', full_name: 'Aluno', school_id: 'toledo' },
    }], error: null }) }) }) }),
    update: (payload: { status: string }) => ({ eq: async () => {
      state.status = payload.status;
      return { error: null };
    } }),
  }),
} }));

describe('report refresh after status edits', () => {
  it('refetches cards and lists automatically using the persisted status', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => ({ report: useReportData(), edit: useUpdateStudent() }), { wrapper });
    await waitFor(() => expect(result.current.report.data?.statusCounts.em_andamento).toBe(1));
    await act(async () => { await result.current.edit.mutateAsync({ id: 'student-1', studentCourseId: 'course-1', status: 'desistiu' }); });
    await waitFor(() => expect(result.current.report.data?.statusCounts).toEqual({ em_andamento: 0, finalizado: 0, desistiu: 1 }));
    expect(result.current.report.data?.studentsByStatus.desistiu[0].enrollments[0].status).toBe('desistiu');
    expect(result.current.report.data?.studentsByStatus.em_andamento).toHaveLength(0);
    unmount();
    client.clear();
  });
});