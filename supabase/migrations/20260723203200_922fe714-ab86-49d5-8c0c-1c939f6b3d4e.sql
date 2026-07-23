DROP POLICY IF EXISTS "Read trial_lessons" ON public.trial_lessons;
CREATE POLICY "Read trial_lessons" ON public.trial_lessons
FOR SELECT USING (public.has_school_access(school_id));