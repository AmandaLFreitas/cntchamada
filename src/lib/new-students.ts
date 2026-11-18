import { supabase } from '@/integrations/supabase/client';

const STUDENT_ID_CHUNK_SIZE = 500;

export async function fetchStudentIdsWithAnyAttendance(studentIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  const ids = [...new Set(studentIds.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += STUDENT_ID_CHUNK_SIZE) chunks.push(ids.slice(i, i + STUDENT_ID_CHUNK_SIZE));

  await Promise.all(chunks.map(async (chunk) => {
    const { data, error } = await (supabase as any).rpc('students_with_attendance', { _student_ids: chunk });
    if (error) throw error;
    (data ?? []).forEach((row: any) => result.add(typeof row === 'string' ? row : row.students_with_attendance));
  }));

  return result;
}
