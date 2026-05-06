ALTER TABLE public.trial_lessons ADD COLUMN IF NOT EXISTS observations TEXT;
ALTER TABLE public.student_courses ADD COLUMN IF NOT EXISTS rescue_flagged BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON public.attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_slot_date ON public.attendance(time_slot_id, date);
CREATE INDEX IF NOT EXISTS idx_student_schedules_slot ON public.student_schedules(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_student_schedules_student_course ON public.student_schedules(student_course_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_student_school ON public.student_courses(student_id, school_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_active ON public.student_courses(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_students_school ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_student_observations_student ON public.student_observations(student_id);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_school_date ON public.trial_lessons(school_id, lesson_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_student_slot_date ON public.attendance(student_id, time_slot_id, date);

-- Tighten RLS: require authentication for sensitive tables
DROP POLICY IF EXISTS "Allow all access to students" ON public.students;
CREATE POLICY "Authenticated full access students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to student_courses" ON public.student_courses;
CREATE POLICY "Authenticated full access student_courses" ON public.student_courses FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to student_schedules" ON public.student_schedules;
CREATE POLICY "Authenticated full access student_schedules" ON public.student_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to attendance" ON public.attendance;
CREATE POLICY "Authenticated full access attendance" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to student_observations" ON public.student_observations;
CREATE POLICY "Authenticated full access student_observations" ON public.student_observations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to completions" ON public.completions;
CREATE POLICY "Authenticated full access completions" ON public.completions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to trial_lessons" ON public.trial_lessons;
CREATE POLICY "Authenticated full access trial_lessons" ON public.trial_lessons FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to courses" ON public.courses;
CREATE POLICY "Authenticated read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update courses" ON public.courses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete courses" ON public.courses FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all access to time_slots" ON public.time_slots;
CREATE POLICY "Authenticated read time_slots" ON public.time_slots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all access to schools" ON public.schools;
CREATE POLICY "Authenticated read schools" ON public.schools FOR SELECT TO authenticated USING (true);