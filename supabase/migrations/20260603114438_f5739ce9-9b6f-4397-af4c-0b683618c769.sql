
DROP POLICY IF EXISTS "Anyone can read student photos" ON storage.objects;

CREATE POLICY "School members can list student photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-photos'
  AND public.has_school_access(((storage.foldername(name))[1])::uuid)
);
