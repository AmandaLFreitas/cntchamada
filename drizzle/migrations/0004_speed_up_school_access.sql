CREATE OR REPLACE FUNCTION public.current_user_school_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(school_id), '{}') FROM public.user_schools WHERE user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_school_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_school_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.students_with_attendance(_student_ids uuid[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT s.id FROM unnest(_student_ids) AS s(id)
  WHERE EXISTS (SELECT 1 FROM public.attendance a WHERE a.student_id = s.id)
$$;
REVOKE EXECUTE ON FUNCTION public.students_with_attendance(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.students_with_attendance(uuid[]) TO authenticated;

DO $$
DECLARE t text; c text := 'school_id IN (SELECT unnest(public.current_user_school_ids()))';
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance','students','student_courses','student_schedules'] LOOP
    EXECUTE format('ALTER POLICY "School-scoped read %1$s" ON public.%1$I USING (%2$s)', t, c);
    EXECUTE format('ALTER POLICY "School-scoped update %1$s" ON public.%1$I USING (%2$s) WITH CHECK (%2$s)', t, c);
    EXECUTE format('ALTER POLICY "School-scoped delete %1$s" ON public.%1$I USING (%2$s)', t, c);
    EXECUTE format('ALTER POLICY "School-scoped insert %1$s" ON public.%1$I WITH CHECK (%2$s)', t, c);
  END LOOP;
END $$;