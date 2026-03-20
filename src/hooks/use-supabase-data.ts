import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetch all time slots
export function useTimeSlots() {
  return useQuery({
    queryKey: ['time_slots'],
    queryFn: async () => {
      const { data, error } = await supabase.from('time_slots').select('*');
      if (error) throw error;
      return data;
    },
  });
}

// Fetch all courses
export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

// Fetch active students
export function useStudents(activeOnly = true) {
  return useQuery({
    queryKey: ['students', activeOnly],
    queryFn: async () => {
      let query = supabase.from('students').select('*, courses(name, workload)');
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query.order('full_name');
      if (error) throw error;
      return data;
    },
  });
}

// Fetch student schedules
export function useStudentSchedules() {
  return useQuery({
    queryKey: ['student_schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_schedules')
        .select('*, students(id, full_name, is_active, course_id, custom_course_name, courses(name, workload)), time_slots(*)');
      if (error) throw error;
      return data;
    },
  });
}

// Fetch schedules for a specific time slot
export function useSlotStudents(timeSlotId: string | null) {
  return useQuery({
    queryKey: ['slot_students', timeSlotId],
    enabled: !!timeSlotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_schedules')
        .select('*, students(id, full_name, course_id, custom_course_name, enrollment_date, is_active, workload, courses(name, workload))')
        .eq('time_slot_id', timeSlotId!);
      if (error) throw error;
      return data?.filter(s => s.students?.is_active) ?? [];
    },
  });
}

// Count students per slot
export function useSlotCounts() {
  return useQuery({
    queryKey: ['slot_counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_schedules')
        .select('time_slot_id, students!inner(is_active)')
        .eq('students.is_active', true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(s => {
        counts[s.time_slot_id] = (counts[s.time_slot_id] || 0) + 1;
      });
      return counts;
    },
  });
}

// Attendance
export function useAttendance(date: string, timeSlotId: string | null) {
  return useQuery({
    queryKey: ['attendance', date, timeSlotId],
    enabled: !!timeSlotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', date)
        .eq('time_slot_id', timeSlotId!);
      if (error) throw error;
      return data;
    },
  });
}

// Save attendance
export function useSaveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, timeSlotId, date, status }: { studentId: string; timeSlotId: string; date: string; status: string }) => {
      const { data, error } = await supabase
        .from('attendance')
        .upsert({ student_id: studentId, time_slot_id: timeSlotId, date, status }, { onConflict: 'student_id,time_slot_id,date' })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

// Create student
export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (student: {
      full_name?: string; street?: string; house_number?: string; birth_date?: string;
      cpf?: string; enrollment_date?: string; course_id?: string | null; custom_course_name?: string;
      guardian_name?: string; guardian_phone?: string; workload?: number; status?: string;
      schedules?: string[]; // time_slot_ids
    }) => {
      const { schedules, ...studentData } = student;
      const { data, error } = await supabase.from('students').insert(studentData).select().single();
      if (error) throw error;
      if (schedules && schedules.length > 0) {
        const { error: schedError } = await supabase.from('student_schedules').insert(
          schedules.map(tsId => ({ student_id: data.id, time_slot_id: tsId }))
        );
        if (schedError) throw schedError;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student_schedules'] });
      qc.invalidateQueries({ queryKey: ['slot_counts'] });
    },
  });
}

// Update student
export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, schedules, ...studentData }: {
      id: string; full_name?: string; street?: string; house_number?: string; birth_date?: string;
      cpf?: string; enrollment_date?: string; course_id?: string | null; custom_course_name?: string;
      guardian_name?: string; guardian_phone?: string; workload?: number; status?: string;
      is_active?: boolean;
      schedules?: string[];
    }) => {
      const { error } = await supabase.from('students').update(studentData).eq('id', id);
      if (error) throw error;
      if (schedules !== undefined) {
        await supabase.from('student_schedules').delete().eq('student_id', id);
        if (schedules.length > 0) {
          const { error: schedError } = await supabase.from('student_schedules').insert(
            schedules.map(tsId => ({ student_id: id, time_slot_id: tsId }))
          );
          if (schedError) throw schedError;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student_schedules'] });
      qc.invalidateQueries({ queryKey: ['slot_counts'] });
      qc.invalidateQueries({ queryKey: ['slot_students'] });
    },
  });
}

// Delete student
export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student_schedules'] });
      qc.invalidateQueries({ queryKey: ['slot_counts'] });
    },
  });
}

// Complete student course
export function useCompleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, courseName, startDate }: { studentId: string; courseName: string; startDate: string | null }) => {
      const { error: compError } = await supabase.from('completions').insert({
        student_id: studentId,
        course_name: courseName,
        start_date: startDate,
      });
      if (compError) throw compError;
      const { error } = await supabase.from('students').update({ is_active: false }).eq('id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['completions'] });
      qc.invalidateQueries({ queryKey: ['student_schedules'] });
      qc.invalidateQueries({ queryKey: ['slot_counts'] });
      qc.invalidateQueries({ queryKey: ['slot_students'] });
    },
  });
}

// Fetch completions
export function useCompletions() {
  return useQuery({
    queryKey: ['completions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('completions')
        .select('*, students(full_name)')
        .order('end_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// Get first attendance date for a student
export function useFirstAttendance(studentId: string | null) {
  return useQuery({
    queryKey: ['first_attendance', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('date')
        .eq('student_id', studentId!)
        .eq('status', 'present')
        .order('date', { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.date ?? null;
    },
  });
}

// Report data
export function useReportData() {
  return useQuery({
    queryKey: ['report_data'],
    queryFn: async () => {
      const { data: students, error: sErr } = await supabase
        .from('students')
        .select('*, courses(name)')
        .eq('is_active', true)
        .order('full_name');
      if (sErr) throw sErr;

      const { data: attendance, error: aErr } = await supabase
        .from('attendance')
        .select('student_id, status');
      if (aErr) throw aErr;

      const { data: completions, error: cErr } = await supabase
        .from('completions')
        .select('student_id, start_date, end_date');
      if (cErr) throw cErr;

      const { data: firstDates, error: fErr } = await supabase
        .from('attendance')
        .select('student_id, date')
        .eq('status', 'present')
        .order('date', { ascending: true });
      if (fErr) throw fErr;

      // Build first attendance map
      const firstAttendance: Record<string, string> = {};
      firstDates?.forEach(r => {
        if (!firstAttendance[r.student_id]) firstAttendance[r.student_id] = r.date;
      });

      // Build attendance counts
      const attendanceCounts: Record<string, { present: number; absent: number }> = {};
      attendance?.forEach(r => {
        if (!attendanceCounts[r.student_id]) attendanceCounts[r.student_id] = { present: 0, absent: 0 };
        if (r.status === 'present') attendanceCounts[r.student_id].present++;
        else if (r.status === 'absent') attendanceCounts[r.student_id].absent++;
        // 'neutral' doesn't count as either
      });

      // Build completions map
      const completionMap: Record<string, { start_date: string | null; end_date: string }> = {};
      completions?.forEach(r => {
        completionMap[r.student_id] = { start_date: r.start_date, end_date: r.end_date };
      });

      return {
        students: students ?? [],
        attendanceCounts,
        firstAttendance,
        completionMap,
      };
    },
  });
}
