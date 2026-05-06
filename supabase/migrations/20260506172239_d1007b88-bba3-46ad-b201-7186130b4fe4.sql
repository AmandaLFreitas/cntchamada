
ALTER TABLE public.student_courses 
  ADD COLUMN IF NOT EXISTS rescue_next_course_id uuid,
  ADD COLUMN IF NOT EXISTS rescue_observations text,
  ADD COLUMN IF NOT EXISTS rescue_contact_status text;
