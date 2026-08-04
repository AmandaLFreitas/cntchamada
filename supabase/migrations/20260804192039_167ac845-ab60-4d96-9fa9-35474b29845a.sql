CREATE OR REPLACE FUNCTION public.can_manage_trial_lessons()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (role = 'admin'::app_role OR display_name = 'Rafael')
  )
$$;

REVOKE ALL ON FUNCTION public.can_manage_trial_lessons() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_trial_lessons() TO authenticated;

DROP POLICY IF EXISTS "Admins insert trial_lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "Admins update trial_lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "Admins delete trial_lessons" ON public.trial_lessons;

CREATE POLICY "Manage insert trial_lessons" ON public.trial_lessons
FOR INSERT TO authenticated
WITH CHECK ((public.has_school_access(school_id) OR public.has_trial_lessons_all_access()) AND public.can_manage_trial_lessons());

CREATE POLICY "Manage update trial_lessons" ON public.trial_lessons
FOR UPDATE TO authenticated
USING ((public.has_school_access(school_id) OR public.has_trial_lessons_all_access()) AND public.can_manage_trial_lessons())
WITH CHECK ((public.has_school_access(school_id) OR public.has_trial_lessons_all_access()) AND public.can_manage_trial_lessons());

CREATE POLICY "Manage delete trial_lessons" ON public.trial_lessons
FOR DELETE TO authenticated
USING ((public.has_school_access(school_id) OR public.has_trial_lessons_all_access()) AND public.can_manage_trial_lessons());