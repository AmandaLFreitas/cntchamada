DROP POLICY IF EXISTS "Authenticated read schools" ON public.schools;
CREATE POLICY "Public can read schools" ON public.schools FOR SELECT TO anon, authenticated USING (true);