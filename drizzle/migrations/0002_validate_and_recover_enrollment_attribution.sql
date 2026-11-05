CREATE OR REPLACE FUNCTION public.attendance_enrollment_date(value text) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE parsed date;
BEGIN
 IF value ~ '^\d{2}/\d{2}/\d{4}$' THEN
  parsed := to_date(value, 'DD/MM/YYYY');
  IF to_char(parsed,'DD/MM/YYYY') <> value THEN RETURN NULL; END IF;
 ELSIF value ~ '^\d{4}-\d{2}-\d{2}$' THEN parsed := value::date;
 ELSE RETURN NULL;
 END IF;
 RETURN parsed;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.safe_legacy_attendance_enrollment(student uuid, school uuid, lesson date) RETURNS uuid LANGUAGE sql STABLE SET search_path=public AS $$
 WITH enrollments AS (
 SELECT sc.id, public.attendance_enrollment_date(sc.enrollment_date) AS starts, sc.status,
 (SELECT count(*) FROM public.completions c WHERE c.student_id=student AND c.school_id=school AND c.course_name=coalesce(co.name,sc.custom_course_name)) AS completion_count,
 (SELECT max(c.end_date) FROM public.completions c WHERE c.student_id=student AND c.school_id=school AND c.course_name=coalesce(co.name,sc.custom_course_name)) AS ends
 FROM public.student_courses sc LEFT JOIN public.courses co ON co.id=sc.course_id WHERE sc.student_id=student AND sc.school_id=school
 ), candidates AS (
 SELECT id FROM enrollments WHERE starts IS NOT NULL AND starts <= lesson AND
 (status='em_andamento' OR (status='finalizado' AND completion_count=1 AND ends>=lesson))
 )
 SELECT CASE WHEN (SELECT count(*) FROM candidates)=1 AND NOT EXISTS (SELECT 1 FROM enrollments WHERE starts IS NULL OR (starts<=lesson AND status NOT IN ('em_andamento','finalizado')) OR (starts<=lesson AND status='finalizado' AND completion_count<>1)) THEN (SELECT id FROM candidates LIMIT 1) ELSE NULL END;
$$;
CREATE OR REPLACE FUNCTION public.validate_attendance_enrollment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE slot_duration numeric; starts date; valid_course boolean;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.time_slot_id IS DISTINCT FROM OLD.time_slot_id OR NEW.date IS DISTINCT FROM OLD.date THEN RAISE EXCEPTION 'A identidade da presença histórica não pode ser alterada.'; END IF;
  IF NEW.student_course_id IS DISTINCT FROM OLD.student_course_id THEN
   IF OLD.student_course_id IS NOT NULL OR NEW.student_course_id IS NULL OR NEW.student_course_id IS DISTINCT FROM public.safe_legacy_attendance_enrollment(OLD.student_id,OLD.school_id,OLD.date) OR NEW.status IS DISTINCT FROM OLD.status OR NEW.is_justified IS DISTINCT FROM OLD.is_justified OR NEW.absence_note IS DISTINCT FROM OLD.absence_note THEN RAISE EXCEPTION 'Vínculo histórico ambíguo ou transferência de matrícula não permitida.'; END IF;
   SELECT extract(epoch FROM (end_time::time-start_time::time))/3600 INTO slot_duration FROM public.time_slots WHERE id=OLD.time_slot_id;
   NEW.recorded_hours := coalesce(OLD.recorded_hours,slot_duration);
   NEW.updated_at := OLD.updated_at;
  ELSE NEW.recorded_hours := OLD.recorded_hours;
  END IF;
  RETURN NEW;
 END IF;
 SELECT true,public.attendance_enrollment_date(sc.enrollment_date) INTO valid_course,starts FROM public.student_courses sc WHERE sc.id=NEW.student_course_id AND sc.student_id=NEW.student_id AND sc.school_id=NEW.school_id;
 IF valid_course IS DISTINCT FROM true THEN RAISE EXCEPTION 'A matrícula não pertence ao aluno e à unidade informados.'; END IF;
 IF starts IS NOT NULL AND NEW.date<starts THEN RAISE EXCEPTION 'A presença não pode ser anterior à data de matrícula.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.student_schedules ss WHERE ss.student_course_id=NEW.student_course_id AND ss.student_id=NEW.student_id AND ss.school_id=NEW.school_id AND ss.time_slot_id=NEW.time_slot_id) THEN RAISE EXCEPTION 'O horário não pertence à matrícula selecionada.'; END IF;
 SELECT extract(epoch FROM (end_time::time-start_time::time))/3600 INTO slot_duration FROM public.time_slots WHERE id=NEW.time_slot_id;
 IF slot_duration IS NULL OR slot_duration<=0 THEN RAISE EXCEPTION 'Duração de horário inválida.'; END IF;
 NEW.recorded_hours := slot_duration;
 RETURN NEW;
END; $$;