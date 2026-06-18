import { supabase } from '@/integrations/supabase/client';

const ATTENDANCE_PAGE_SIZE = 1000;
const STUDENT_ID_CHUNK_SIZE = 200;

const uniqueChunks = (ids: string[], size: number): string[][] => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += size) {
    chunks.push(uniqueIds.slice(i, i + size));
  }
  return chunks;
};

export async function fetchStudentIdsWithAnyAttendance(studentIds: string[]): Promise<Set<string>> {
  const studentIdsWithAttendance = new Set<string>();

  for (const chunk of uniqueChunks(studentIds, STUDENT_ID_CHUNK_SIZE)) {
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id')
        .in('student_id', chunk)
        .order('id', { ascending: true })
        .range(from, from + ATTENDANCE_PAGE_SIZE - 1);

      if (error) throw error;

      (data ?? []).forEach((row) => studentIdsWithAttendance.add(row.student_id));

      if (!data || data.length < ATTENDANCE_PAGE_SIZE) break;
      from += ATTENDANCE_PAGE_SIZE;
    }
  }

  return studentIdsWithAttendance;
}