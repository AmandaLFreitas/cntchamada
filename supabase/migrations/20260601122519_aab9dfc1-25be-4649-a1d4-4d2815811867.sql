
-- 1. user_schools mapping table
CREATE TABLE IF NOT EXISTS public.user_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);

GRANT SELECT ON public.user_schools TO authenticated;
GRANT ALL ON public.user_schools TO service_role;

ALTER TABLE public.user_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own school memberships"
ON public.user_schools FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.has_school_access(_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools
    WHERE user_id = auth.uid() AND school_id = _school_id
  )
$$;

-- Lock down EXECUTE on security definer functions
REVOKE EXECUTE ON FUNCTION public.has_school_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_school_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- 3. Seed existing users with access to every school (preserves current behavior)
INSERT INTO public.user_schools (user_id, school_id)
SELECT ur.user_id, s.id
FROM public.user_roles ur
CROSS JOIN public.schools s
ON CONFLICT (user_id, school_id) DO NOTHING;

-- 4. Replace permissive RLS policies with school-scoped ones

-- attendance
DROP POLICY IF EXISTS "Authenticated full access attendance" ON public.attendance;
CREATE POLICY "School-scoped read attendance" ON public.attendance
  FOR SELECT TO authenticated USING (public.has_school_access(school_id));
CREATE POLICY "School-scoped insert attendance" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped update attendance" ON public.attendance
  FOR UPDATE TO authenticated USING (public.has_school_access(school_id))
  WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped delete attendance" ON public.attendance
  FOR DELETE TO authenticated USING (public.has_school_access(school_id));

-- completions
DROP POLICY IF EXISTS "Authenticated full access completions" ON public.completions;
CREATE POLICY "School-scoped read completions" ON public.completions
  FOR SELECT TO authenticated USING (public.has_school_access(school_id));
CREATE POLICY "School-scoped insert completions" ON public.completions
  FOR INSERT TO authenticated WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped update completions" ON public.completions
  FOR UPDATE TO authenticated USING (public.has_school_access(school_id))
  WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped delete completions" ON public.completions
  FOR DELETE TO authenticated USING (public.has_school_access(school_id));

-- student_courses
DROP POLICY IF EXISTS "Authenticated full access student_courses" ON public.student_courses;
CREATE POLICY "School-scoped read student_courses" ON public.student_courses
  FOR SELECT TO authenticated USING (public.has_school_access(school_id));
CREATE POLICY "School-scoped insert student_courses" ON public.student_courses
  FOR INSERT TO authenticated WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped update student_courses" ON public.student_courses
  FOR UPDATE TO authenticated USING (public.has_school_access(school_id))
  WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped delete student_courses" ON public.student_courses
  FOR DELETE TO authenticated USING (public.has_school_access(school_id));

-- student_observations
DROP POLICY IF EXISTS "Authenticated full access student_observations" ON public.student_observations;
CREATE POLICY "School-scoped read student_observations" ON public.student_observations
  FOR SELECT TO authenticated USING (public.has_school_access(school_id));
CREATE POLICY "School-scoped insert student_observations" ON public.student_observations
  FOR INSERT TO authenticated WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped update student_observations" ON public.student_observations
  FOR UPDATE TO authenticated USING (public.has_school_access(school_id))
  WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped delete student_observations" ON public.student_observations
  FOR DELETE TO authenticated USING (public.has_school_access(school_id));

-- student_schedules
DROP POLICY IF EXISTS "Authenticated full access student_schedules" ON public.student_schedules;
CREATE POLICY "School-scoped read student_schedules" ON public.student_schedules
  FOR SELECT TO authenticated USING (public.has_school_access(school_id));
CREATE POLICY "School-scoped insert student_schedules" ON public.student_schedules
  FOR INSERT TO authenticated WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped update student_schedules" ON public.student_schedules
  FOR UPDATE TO authenticated USING (public.has_school_access(school_id))
  WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped delete student_schedules" ON public.student_schedules
  FOR DELETE TO authenticated USING (public.has_school_access(school_id));

-- students
DROP POLICY IF EXISTS "Authenticated full access students" ON public.students;
CREATE POLICY "School-scoped read students" ON public.students
  FOR SELECT TO authenticated USING (public.has_school_access(school_id));
CREATE POLICY "School-scoped insert students" ON public.students
  FOR INSERT TO authenticated WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped update students" ON public.students
  FOR UPDATE TO authenticated USING (public.has_school_access(school_id))
  WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped delete students" ON public.students
  FOR DELETE TO authenticated USING (public.has_school_access(school_id));

-- trial_lessons
DROP POLICY IF EXISTS "Authenticated full access trial_lessons" ON public.trial_lessons;
CREATE POLICY "School-scoped read trial_lessons" ON public.trial_lessons
  FOR SELECT TO authenticated USING (public.has_school_access(school_id));
CREATE POLICY "School-scoped insert trial_lessons" ON public.trial_lessons
  FOR INSERT TO authenticated WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped update trial_lessons" ON public.trial_lessons
  FOR UPDATE TO authenticated USING (public.has_school_access(school_id))
  WITH CHECK (public.has_school_access(school_id));
CREATE POLICY "School-scoped delete trial_lessons" ON public.trial_lessons
  FOR DELETE TO authenticated USING (public.has_school_access(school_id));

-- 5. Lock user_roles writes (deny all authenticated writes — only service role can manage)
CREATE POLICY "Deny role inserts" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny role updates" ON public.user_roles
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny role deletes" ON public.user_roles
  FOR DELETE TO authenticated USING (false);
