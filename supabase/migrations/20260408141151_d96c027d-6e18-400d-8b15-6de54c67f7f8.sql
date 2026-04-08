
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS material_sent boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.student_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  observation text NOT NULL,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to student_observations" ON public.student_observations
  FOR ALL TO public USING (true) WITH CHECK (true);
