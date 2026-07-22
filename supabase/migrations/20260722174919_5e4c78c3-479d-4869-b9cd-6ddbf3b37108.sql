
-- Migração: Consolidar cursos exclusivamente em student_courses
-- 1) Migrar dado divergente (Osana Padilha da Rocha) que existia apenas em students
INSERT INTO public.student_courses (student_id, school_id, course_id, custom_course_name, workload, status, payment_method, is_active)
SELECT s.id, s.school_id, s.course_id, s.custom_course_name,
       COALESCE(s.workload, 48), COALESCE(s.status, 'em_andamento'),
       s.payment_method,
       CASE WHEN COALESCE(s.status,'em_andamento') IN ('finalizado','desistiu') THEN false ELSE true END
FROM public.students s
WHERE s.id = '4a984d20-17a2-4e28-b81b-e11ced82c7b8'
  AND NOT EXISTS (
    SELECT 1 FROM public.student_courses sc
    WHERE sc.student_id = s.id AND sc.course_id = s.course_id
  );

-- 2) Remover FK legada e colunas duplicadas
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_course_id_fkey;
ALTER TABLE public.students
  DROP COLUMN IF EXISTS course_id,
  DROP COLUMN IF EXISTS custom_course_name,
  DROP COLUMN IF EXISTS enrollment_date,
  DROP COLUMN IF EXISTS first_class_date,
  DROP COLUMN IF EXISTS workload,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS payment_method;
