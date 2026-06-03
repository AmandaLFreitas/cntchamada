-- Restrict sensitive columns from restricted users by revoking column-level SELECT
-- Admins access these via SECURITY DEFINER RPCs (get_student_pii, get_student_course_payment) or admin-only future RPCs.

-- 1) students.payment_method — match the revoke applied to student_courses.payment_method
REVOKE SELECT (payment_method) ON public.students FROM authenticated;
REVOKE SELECT (payment_method) ON public.students FROM anon;

-- 2) trial_lessons.phone — only admins should read phone numbers
REVOKE SELECT (phone) ON public.trial_lessons FROM authenticated;
REVOKE SELECT (phone) ON public.trial_lessons FROM anon;

-- Admin-only RPC to read a trial lesson phone when needed by the UI
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
    AND public.has_school_access(t.school_id);
  RETURN p;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trial_lesson_phone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trial_lesson_phone(uuid) TO authenticated;