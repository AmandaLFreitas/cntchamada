import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Helper for student_courses table (may not be in auto-generated types yet)
const scTable = () => (supabase as any).from('student_courses');

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

// Fetch students with their student_courses
export function useStudents(activeOnly = true) {
  return useQuery({
    queryKey: ['students', activeOnly],
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .order('full_name');
      if (error) throw error;

      const { data: scs, error: scErr } = await scTable()
        .select('*, courses(name, workload)');
      if (scErr) throw scErr;

      const result = (students ?? []).map((s: any) => ({
        ...s,
        student_courses: (scs ?? []).filter((sc: any) => sc.student_id === s.id),
      }));

      if (activeOnly) {
        return result.filter((s: any) =>
          s.student_courses.some((sc: any) => sc.is_active)
        );
      }
      return result;
    },
  });
}

// Fetch student_courses for a specific student
export function useStudentCourses(studentId: string | null) {
  return useQuery({
    queryKey: ['student_courses', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await scTable()
        .select('*, courses(name, workload)')
        .eq('student_id', studentId!);
      if (error) throw error;
      return data ?? [];
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
        .select('*, time_slots(*)');
      if (error) throw error;

      // Enrich with student_courses data
      const scIds = [...new Set((data ?? []).map((d: any) => d.student_course_id).filter(Boolean))];
      let scMap: Record<string, any> = {};
      if (scIds.length > 0) {
        const { data: scData } = await scTable()
          .select('*, students(id, full_name, is_active, birth_date), courses(name, workload)')
          .in('id', scIds);
        (scData ?? []).forEach((sc: any) => { scMap[sc.id] = sc; });
      }

      return (data ?? []).map((d: any) => {
        const sc = scMap[d.student_course_id];
        return {
          ...d,
          students: sc?.students ? {
            ...sc.students,
            course_id: sc.course_id,
            custom_course_name: sc.custom_course_name,
            courses: sc.courses,
            workload: sc.workload,
          } : null,
        };
      });
    },
  });
}

// Fetch schedules for a specific time slot (backward-compatible shape)
export function useSlotStudents(timeSlotId: string | null) {
  return useQuery({
    queryKey: ['slot_students', timeSlotId],
    enabled: !!timeSlotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_schedules')
        .select('*')
        .eq('time_slot_id', timeSlotId!);
      if (error) throw error;

      const scIds = [...new Set((data ?? []).map((d: any) => d.student_course_id).filter(Boolean))];
      let scMap: Record<string, any> = {};
      if (scIds.length > 0) {
        const { data: scData } = await scTable()
          .select('*, students(*), courses(name, workload)')
          .in('id', scIds);
        (scData ?? []).forEach((sc: any) => { scMap[sc.id] = sc; });
      }

      return (data ?? [])
        .map((d: any) => {
          const sc = scMap[d.student_course_id];
          if (!sc || !sc.students) return null;
          return {
            ...d,
            students: {
              ...sc.students,
              course_id: sc.course_id,
              custom_course_name: sc.custom_course_name,
              courses: sc.courses,
              workload: sc.workload,
              enrollment_date: sc.enrollment_date,
              first_class_date: sc.first_class_date,
            },
          };
        })
        .filter((s: any) => {
          if (!s) return false;
          const sc = scMap[s.student_course_id];
          return sc?.is_active;
        });
    },
  });
}

// Count students per slot
export function useSlotCounts() {
  return useQuery({
    queryKey: ['slot_counts'],
    queryFn: async () => {
      const { data: schedules, error } = await supabase
        .from('student_schedules')
        .select('time_slot_id, student_course_id');
      if (error) throw error;

      const scIds = [...new Set((schedules ?? []).map((d: any) => d.student_course_id).filter(Boolean))];
      let activeScIds = new Set<string>();
      if (scIds.length > 0) {
        const { data: scData } = await scTable()
          .select('id')
          .in('id', scIds)
          .eq('is_active', true);
        (scData ?? []).forEach((sc: any) => activeScIds.add(sc.id));
      }

      const counts: Record<string, number> = {};
      (schedules ?? []).forEach((s: any) => {
        if (activeScIds.has(s.student_course_id)) {
          counts[s.time_slot_id] = (counts[s.time_slot_id] || 0) + 1;
        }
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

// Create student + student_course + schedules
export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      full_name?: string; street?: string; house_number?: string; birth_date?: string;
      cpf?: string; guardian_name?: string; guardian_phone?: string;
      // Course data
      course_id?: string | null; custom_course_name?: string;
      enrollment_date?: string; first_class_date?: string;
      workload?: number; status?: string; payment_method?: string;
      schedules?: string[];
      // For adding course to existing student
      existingStudentId?: string;
    }) => {
      const { schedules, existingStudentId, course_id, custom_course_name, enrollment_date, first_class_date, workload, status, payment_method, ...personalData } = input;

      let studentId: string;

      if (existingStudentId) {
        studentId = existingStudentId;
        // Update personal data
        const { error } = await supabase.from('students').update(personalData).eq('id', studentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('students').insert(personalData).select().single();
        if (error) throw error;
        studentId = data.id;
      }

      // Create student_course
      const isActive = status !== 'finalizado' && status !== 'desistiu';
      const { data: sc, error: scErr } = await scTable()
        .insert({
          student_id: studentId,
          course_id: course_id || null,
          custom_course_name: custom_course_name || null,
          enrollment_date: enrollment_date || null,
          first_class_date: first_class_date || null,
          workload: workload ?? 48,
          status: status || 'em_andamento',
          payment_method: payment_method || null,
          is_active: isActive,
        })
        .select()
        .single();
      if (scErr) throw scErr;

      // Create schedules
      if (schedules && schedules.length > 0 && isActive) {
        const { error: schedError } = await supabase.from('student_schedules').insert(
          schedules.map(tsId => ({ student_id: studentId, time_slot_id: tsId, student_course_id: sc.id }))
        );
        if (schedError) throw schedError;
      }

      return { studentId, studentCourseId: sc.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student_courses'] });
      qc.invalidateQueries({ queryKey: ['student_schedules'] });
      qc.invalidateQueries({ queryKey: ['slot_counts'] });
      qc.invalidateQueries({ queryKey: ['slot_students'] });
    },
  });
}

// Update student personal data + student_course
export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string; // student id
      studentCourseId?: string; // which course to update
      full_name?: string; street?: string; house_number?: string; birth_date?: string;
      cpf?: string; guardian_name?: string; guardian_phone?: string;
      // Course data
      course_id?: string | null; custom_course_name?: string;
      enrollment_date?: string; first_class_date?: string;
      workload?: number; status?: string; payment_method?: string;
      is_active?: boolean;
      schedules?: string[];
    }) => {
      const { id, studentCourseId, schedules, course_id, custom_course_name, enrollment_date, first_class_date, workload, status, payment_method, is_active, ...personalData } = input;

      // Update student personal data
      const cleanPersonal: any = {};
      Object.entries(personalData).forEach(([k, v]) => { if (v !== undefined) cleanPersonal[k] = v; });
      if (Object.keys(cleanPersonal).length > 0) {
        const { error } = await supabase.from('students').update(cleanPersonal).eq('id', id);
        if (error) throw error;
      }

      // Update student_course if provided
      if (studentCourseId) {
        const courseUpdate: any = {};
        if (course_id !== undefined) courseUpdate.course_id = course_id || null;
        if (custom_course_name !== undefined) courseUpdate.custom_course_name = custom_course_name || null;
        if (enrollment_date !== undefined) courseUpdate.enrollment_date = enrollment_date || null;
        if (first_class_date !== undefined) courseUpdate.first_class_date = first_class_date || null;
        if (workload !== undefined) courseUpdate.workload = workload;
        if (status !== undefined) courseUpdate.status = status;
        if (payment_method !== undefined) courseUpdate.payment_method = payment_method || null;
        if (is_active !== undefined) courseUpdate.is_active = is_active;

        if (status === 'finalizado' || status === 'desistiu') {
          courseUpdate.is_active = false;
        }

        if (Object.keys(courseUpdate).length > 0) {
          const { error } = await scTable().update(courseUpdate).eq('id', studentCourseId);
          if (error) throw error;
        }

        // Update schedules for this student_course
        if (schedules !== undefined) {
          // Deduplicate schedule list
          const uniqueSchedules = [...new Set(schedules)];

          // STEP 1: Delete all schedules for this student_course
          const { error: delError } = await supabase
            .from('student_schedules')
            .delete()
            .eq('student_course_id', studentCourseId);
          if (delError) throw delError;

          // STEP 2: Delete any conflicting orphan records for the same student + time_slots
          if (uniqueSchedules.length > 0) {
            const { error: delOrphanError } = await supabase
              .from('student_schedules')
              .delete()
              .eq('student_id', id)
              .in('time_slot_id', uniqueSchedules);
            if (delOrphanError) throw delOrphanError;
          }

          // STEP 3: Insert new schedules
          if (uniqueSchedules.length > 0) {
            const { error: schedError } = await supabase
              .from('student_schedules')
              .insert(
                uniqueSchedules.map(tsId => ({ student_id: id, time_slot_id: tsId, student_course_id: studentCourseId }))
              );
            if (schedError) throw schedError;
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student_courses'] });
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
      qc.invalidateQueries({ queryKey: ['student_courses'] });
      qc.invalidateQueries({ queryKey: ['student_schedules'] });
      qc.invalidateQueries({ queryKey: ['slot_counts'] });
    },
  });
}

// Complete a student_course
export function useCompleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, studentCourseId, courseName, startDate }: {
      studentId: string; studentCourseId?: string; courseName: string; startDate: string | null;
    }) => {
      // Insert into completions
      const { error: compError } = await supabase.from('completions').insert({
        student_id: studentId,
        course_name: courseName,
        start_date: startDate,
      });
      if (compError) throw compError;

      // Update student_course
      if (studentCourseId) {
        const { error } = await scTable()
          .update({ status: 'finalizado', is_active: false })
          .eq('id', studentCourseId);
        if (error) throw error;
      }

      // Remove schedules for this course
      if (studentCourseId) {
        await supabase.from('student_schedules').delete().eq('student_course_id', studentCourseId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student_courses'] });
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
        .select('*')
        .order('full_name');
      if (sErr) throw sErr;

      const { data: scs, error: scErr } = await scTable()
        .select('*, courses(name)')
        .eq('is_active', true);
      if (scErr) throw scErr;

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

      const firstAttendance: Record<string, string> = {};
      firstDates?.forEach(r => {
        if (!firstAttendance[r.student_id]) firstAttendance[r.student_id] = r.date;
      });

      const attendanceCounts: Record<string, { present: number; absent: number }> = {};
      attendance?.forEach(r => {
        if (!attendanceCounts[r.student_id]) attendanceCounts[r.student_id] = { present: 0, absent: 0 };
        if (r.status === 'present') attendanceCounts[r.student_id].present++;
        else if (r.status === 'absent') attendanceCounts[r.student_id].absent++;
      });

      const completionMap: Record<string, { start_date: string | null; end_date: string }> = {};
      completions?.forEach(r => {
        completionMap[r.student_id] = { start_date: r.start_date, end_date: r.end_date };
      });

      // Attach active courses to students
      const studentsWithCourses = (students ?? []).map((s: any) => ({
        ...s,
        student_courses: (scs ?? []).filter((sc: any) => sc.student_id === s.id),
      }));

      return {
        students: studentsWithCourses,
        attendanceCounts,
        firstAttendance,
        completionMap,
      };
    },
  });
}
