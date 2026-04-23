
CREATE TABLE public.trial_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  phone TEXT,
  course TEXT,
  time_slot TEXT,
  lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'OK',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to trial_lessons"
ON public.trial_lessons
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_trial_lessons_updated_at
BEFORE UPDATE ON public.trial_lessons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
