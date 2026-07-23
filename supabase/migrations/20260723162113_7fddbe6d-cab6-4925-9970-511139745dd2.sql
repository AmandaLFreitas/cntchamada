
-- Add unit/creator tracking to trial_lessons
ALTER TABLE public.trial_lessons
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- Helper: allow specific users cross-school access to trial_lessons only
CREATE OR REPLACE FUNCTION public.has_trial_lessons_all_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND display_name = 'Cris'
  )
$$;

-- Rebuild trial_lessons RLS: SELECT and admin write policies extended for cross-school users
DROP POLICY IF EXISTS "School-scoped read trial_lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "Admins insert trial_lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "Admins update trial_lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "Admins delete trial_lessons" ON public.trial_lessons;

CREATE POLICY "Read trial_lessons"
  ON public.trial_lessons FOR SELECT TO authenticated
  USING (public.has_school_access(school_id) OR public.has_trial_lessons_all_access());

CREATE POLICY "Admins insert trial_lessons"
  ON public.trial_lessons FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_school_access(school_id) OR public.has_trial_lessons_all_access())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins update trial_lessons"
  ON public.trial_lessons FOR UPDATE TO authenticated
  USING (
    (public.has_school_access(school_id) OR public.has_trial_lessons_all_access())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (public.has_school_access(school_id) OR public.has_trial_lessons_all_access())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins delete trial_lessons"
  ON public.trial_lessons FOR DELETE TO authenticated
  USING (
    (public.has_school_access(school_id) OR public.has_trial_lessons_all_access())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Update get_trial_lesson_phone RPC to accept cross-school users
CREATE OR REPLACE FUNCTION public.get_trial_lesson_phone(_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT t.phone INTO p
  FROM public.trial_lessons t
  WHERE t.id = _id
    AND (public.has_school_access(t.school_id) OR public.has_trial_lessons_all_access());
  RETURN p;
END;
$$;
