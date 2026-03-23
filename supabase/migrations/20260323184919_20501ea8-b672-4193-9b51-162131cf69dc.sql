
-- Create student_courses table
CREATE TABLE public.student_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id),
  custom_course_name text,
  status text NOT NULL DEFAULT 'em_andamento',
  workload integer NOT NULL DEFAULT 48,
  enrollment_date text,
  first_class_date text,
  payment_method text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to student_courses" ON public.student_courses FOR ALL USING (true) WITH CHECK (true);

-- Migrate existing data from students to student_courses
INSERT INTO public.student_courses (student_id, course_id, custom_course_name, status, workload, enrollment_date, first_class_date, payment_method, is_active)
SELECT id, course_id, custom_course_name, status, workload, enrollment_date, first_class_date, payment_method, is_active
FROM public.students;

-- Add student_course_id to student_schedules
ALTER TABLE public.student_schedules ADD COLUMN student_course_id uuid REFERENCES public.student_courses(id) ON DELETE CASCADE;

-- Populate student_course_id from existing relationships
UPDATE public.student_schedules ss
SET student_course_id = sc.id
FROM public.student_courses sc
WHERE sc.student_id = ss.student_id;

-- Merge duplicate students (same name, case-insensitive)
DO $$
DECLARE
  dup RECORD;
  primary_id uuid;
  dup_id uuid;
  i integer;
BEGIN
  FOR dup IN
    SELECT lower(trim(full_name)) as norm_name,
           array_agg(id ORDER BY created_at) as ids
    FROM public.students
    WHERE full_name IS NOT NULL AND trim(full_name) != ''
    GROUP BY lower(trim(full_name))
    HAVING count(*) > 1
  LOOP
    primary_id := dup.ids[1];
    
    FOR i IN 2..array_length(dup.ids, 1) LOOP
      dup_id := dup.ids[i];
      
      -- Update student_courses to point to primary
      UPDATE public.student_courses SET student_id = primary_id WHERE student_id = dup_id;
      
      -- Update student_schedules to point to primary
      UPDATE public.student_schedules SET student_id = primary_id WHERE student_id = dup_id;
      
      -- Handle attendance conflicts - remove duplicates first
      DELETE FROM public.attendance a1
      WHERE a1.student_id = dup_id
      AND EXISTS (
        SELECT 1 FROM public.attendance a2
        WHERE a2.student_id = primary_id
        AND a2.time_slot_id = a1.time_slot_id
        AND a2.date = a1.date
      );
      UPDATE public.attendance SET student_id = primary_id WHERE student_id = dup_id;
      
      -- Update completions
      UPDATE public.completions SET student_id = primary_id WHERE student_id = dup_id;
      
      -- Delete duplicate student
      DELETE FROM public.students WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;
