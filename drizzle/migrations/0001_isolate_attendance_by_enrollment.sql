ALTER TABLE public.attendance ADD COLUMN student_course_id uuid REFERENCES public.student_courses(id), ADD COLUMN recorded_hours numeric;
COMMENT ON COLUMN public.attendance.student_course_id IS 'Enrollment attribution. NULL identifies preserved legacy attendance requiring verified manual attribution; never infer from current schedules.';
COMMENT ON COLUMN public.attendance.recorded_hours IS 'Actual slot duration captured when attendance is recorded.';
CREATE INDEX attendance_enrollment_idx ON public.attendance(school_id, student_course_id, date);
CREATE OR REPLACE FUNCTION public.validate_attendance_enrollment() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE slot_duration numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.student_course_id IS DISTINCT FROM OLD.student_course_id OR NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.time_slot_id IS DISTINCT FROM OLD.time_slot_id OR NEW.date IS DISTINCT FROM OLD.date THEN
      RAISE EXCEPTION 'A presença existente pertence ao histórico e não pode ser transferida para outra matrícula.';
    END IF;
    NEW.recorded_hours := OLD.recorded_hours;
    RETURN NEW;
  END IF;
  IF NEW.student_course_id IS NULL THEN RAISE EXCEPTION 'Informe a matrícula da presença.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.student_courses sc WHERE sc.id = NEW.student_course_id AND sc.student_id = NEW.student_id AND sc.school_id = NEW.school_id) THEN
    RAISE EXCEPTION 'A matrícula não pertence ao aluno e à unidade informados.';
  END IF;
  SELECT EXTRACT(EPOCH FROM (ts.end_time::time - ts.start_time::time))/3600 INTO slot_duration FROM public.time_slots ts WHERE ts.id = NEW.time_slot_id;
  IF slot_duration IS NULL OR slot_duration <= 0 THEN RAISE EXCEPTION 'Duração de horário inválida.'; END IF;
  NEW.recorded_hours := slot_duration;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_attendance_enrollment BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_enrollment();