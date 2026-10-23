ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

DROP FUNCTION IF EXISTS public.get_student_pii(uuid);

CREATE FUNCTION public.get_student_pii(_id uuid)
RETURNS TABLE(cpf text, street text, house_number text, guardian_name text, guardian_phone text, cep text, neighborhood text, city text, state text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.cpf, s.street, s.house_number, s.guardian_name, s.guardian_phone, s.cep, s.neighborhood, s.city, s.state
  FROM public.students s
  WHERE s.id = _id
    AND public.has_school_access(s.school_id)
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

GRANT EXECUTE ON FUNCTION public.get_student_pii(uuid) TO authenticated;