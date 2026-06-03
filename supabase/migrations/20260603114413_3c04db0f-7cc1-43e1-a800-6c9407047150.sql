
-- 1) Storage: scope writes on student-photos by school folder
DROP POLICY IF EXISTS "Authenticated users can upload student photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update student photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete student photos" ON storage.objects;

CREATE POLICY "School members can upload student photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-photos'
  AND public.has_school_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "School members can update student photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'student-photos'
  AND public.has_school_access(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'student-photos'
  AND public.has_school_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "School members can delete student photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-photos'
  AND public.has_school_access(((storage.foldername(name))[1])::uuid)
);

-- 2) trial_lessons: writes admin-only (reads remain school-scoped)
DROP POLICY IF EXISTS "School-scoped insert trial_lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "School-scoped update trial_lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "School-scoped delete trial_lessons" ON public.trial_lessons;

CREATE POLICY "Admins insert trial_lessons"
ON public.trial_lessons FOR INSERT TO authenticated
WITH CHECK (public.has_school_access(school_id) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update trial_lessons"
ON public.trial_lessons FOR UPDATE TO authenticated
USING (public.has_school_access(school_id) AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_school_access(school_id) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete trial_lessons"
ON public.trial_lessons FOR DELETE TO authenticated
USING (public.has_school_access(school_id) AND public.has_role(auth.uid(), 'admin'::app_role));
