
-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  workload INTEGER NOT NULL DEFAULT 48,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  street TEXT,
  house_number TEXT,
  birth_date TEXT,
  cpf TEXT,
  enrollment_date TEXT,
  course_id UUID REFERENCES public.courses(id),
  custom_course_name TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create time_slots table
CREATE TABLE public.time_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  max_students INTEGER NOT NULL DEFAULT 20,
  UNIQUE(day_of_week, start_time, end_time)
);

-- Create student_schedules (link students to day+time slots)
CREATE TABLE public.student_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, time_slot_id)
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, time_slot_id, date)
);

-- Create completions table
CREATE TABLE public.completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_name TEXT,
  start_date DATE,
  end_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required for this system)
CREATE POLICY "Allow all access to courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to time_slots" ON public.time_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to student_schedules" ON public.student_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to completions" ON public.completions FOR ALL USING (true) WITH CHECK (true);

-- Insert predefined courses
INSERT INTO public.courses (name, workload, is_custom) VALUES
  ('Excel Avançado', 48, false),
  ('SolidWorks', 48, false),
  ('AutoCAD', 48, false),
  ('Informática Administrativa', 48, false),
  ('Informática Básica', 48, false),
  ('Design Gráfico', 48, false),
  ('Auxiliar Administrativo', 48, false),
  ('Programação (Criação de Jogos)', 48, false),
  ('SketchUp', 48, false),
  ('Lógica de Programação em Java', 48, false),
  ('Power BI', 48, false);

-- Insert predefined time slots
INSERT INTO public.time_slots (day_of_week, start_time, end_time) VALUES
  ('Segunda', '08:00', '09:00'),
  ('Segunda', '09:00', '10:00'),
  ('Segunda', '10:00', '11:00'),
  ('Segunda', '13:30', '14:30'),
  ('Segunda', '14:30', '15:30'),
  ('Segunda', '15:30', '16:30'),
  ('Segunda', '16:30', '17:30'),
  ('Terça', '08:00', '09:00'),
  ('Terça', '09:00', '10:00'),
  ('Terça', '10:00', '11:00'),
  ('Terça', '13:30', '14:30'),
  ('Terça', '14:30', '15:30'),
  ('Terça', '15:30', '16:30'),
  ('Terça', '16:30', '17:30'),
  ('Quarta', '08:00', '09:00'),
  ('Quarta', '09:00', '10:00'),
  ('Quarta', '10:00', '11:00'),
  ('Quarta', '13:30', '14:30'),
  ('Quarta', '14:30', '15:30'),
  ('Quarta', '15:30', '16:30'),
  ('Quarta', '16:30', '17:30'),
  ('Quinta', '08:00', '09:00'),
  ('Quinta', '09:00', '10:00'),
  ('Quinta', '10:00', '11:00'),
  ('Quinta', '13:30', '14:30'),
  ('Quinta', '14:30', '15:30'),
  ('Quinta', '15:30', '16:30'),
  ('Quinta', '16:30', '17:30'),
  ('Sábado', '08:00', '10:00'),
  ('Sábado', '10:00', '12:00');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
