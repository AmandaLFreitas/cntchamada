DROP POLICY IF EXISTS "Public can read schools" ON public.schools;
REVOKE SELECT ON public.schools FROM anon;
CREATE POLICY "Members can read their schools" ON public.schools
FOR SELECT TO authenticated
USING (public.has_school_access(id) OR public.has_trial_lessons_all_access());

CREATE OR REPLACE FUNCTION public.list_login_schools()
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT s.id, s.name, s.slug FROM public.schools s ORDER BY s.name $$;
REVOKE ALL ON FUNCTION public.list_login_schools() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_login_schools() TO anon, authenticated;