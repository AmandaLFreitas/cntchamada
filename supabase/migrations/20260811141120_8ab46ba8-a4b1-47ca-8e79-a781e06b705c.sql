CREATE OR REPLACE FUNCTION public.has_trial_lessons_all_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND display_name IN ('Cris', 'Duda')
  )
$function$;

DROP POLICY IF EXISTS "Read trial_lessons" ON public.trial_lessons;
CREATE POLICY "Read trial_lessons" ON public.trial_lessons
FOR SELECT
USING (public.has_school_access(school_id) OR public.has_trial_lessons_all_access());