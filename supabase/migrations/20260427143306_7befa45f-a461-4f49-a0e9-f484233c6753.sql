-- 1. Tabela schools
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to schools"
  ON public.schools
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Sementes Toledo e Cascavel
INSERT INTO public.schools (name, slug) VALUES
  ('Toledo', 'toledo'),
  ('Cascavel', 'cascavel');

-- 3. Adicionar school_id (nullable) nas tabelas de dados separáveis
ALTER TABLE public.students            ADD COLUMN school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.attendance          ADD COLUMN school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.student_courses     ADD COLUMN school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.student_schedules   ADD COLUMN school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.completions         ADD COLUMN school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.student_observations ADD COLUMN school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.trial_lessons       ADD COLUMN school_id uuid REFERENCES public.schools(id);

-- 4. Backfill: todos os registros existentes -> Toledo
DO $$
DECLARE
  toledo_id uuid;
BEGIN
  SELECT id INTO toledo_id FROM public.schools WHERE slug = 'toledo';

  UPDATE public.students            SET school_id = toledo_id WHERE school_id IS NULL;
  UPDATE public.attendance          SET school_id = toledo_id WHERE school_id IS NULL;
  UPDATE public.student_courses     SET school_id = toledo_id WHERE school_id IS NULL;
  UPDATE public.student_schedules   SET school_id = toledo_id WHERE school_id IS NULL;
  UPDATE public.completions         SET school_id = toledo_id WHERE school_id IS NULL;
  UPDATE public.student_observations SET school_id = toledo_id WHERE school_id IS NULL;
  UPDATE public.trial_lessons       SET school_id = toledo_id WHERE school_id IS NULL;
END $$;

-- 5. Tornar school_id obrigatório
ALTER TABLE public.students            ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.attendance          ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.student_courses     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.student_schedules   ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.completions         ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.student_observations ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.trial_lessons       ALTER COLUMN school_id SET NOT NULL;

-- 6. Índices para filtros eficientes por escola
CREATE INDEX IF NOT EXISTS idx_students_school            ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school          ON public.attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_school     ON public.student_courses(school_id);
CREATE INDEX IF NOT EXISTS idx_student_schedules_school   ON public.student_schedules(school_id);
CREATE INDEX IF NOT EXISTS idx_completions_school         ON public.completions(school_id);
CREATE INDEX IF NOT EXISTS idx_student_observations_school ON public.student_observations(school_id);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_school       ON public.trial_lessons(school_id);