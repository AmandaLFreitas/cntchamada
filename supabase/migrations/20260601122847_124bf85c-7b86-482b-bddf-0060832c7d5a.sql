
DROP POLICY IF EXISTS "Authenticated write courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated update courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated delete courses" ON public.courses;

CREATE POLICY "Admins can insert courses" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update courses" ON public.courses
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete courses" ON public.courses
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
