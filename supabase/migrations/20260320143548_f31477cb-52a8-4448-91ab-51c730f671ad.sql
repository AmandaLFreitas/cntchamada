
-- Seed time_slots for weekdays (Segunda to Quinta) and Sábado
INSERT INTO public.time_slots (day_of_week, start_time, end_time) VALUES
  ('Segunda', '08:00', '09:00'), ('Segunda', '09:00', '10:00'), ('Segunda', '10:00', '11:00'),
  ('Segunda', '13:30', '14:30'), ('Segunda', '14:30', '15:30'), ('Segunda', '15:30', '16:30'), ('Segunda', '16:30', '17:30'),
  ('Terça', '08:00', '09:00'), ('Terça', '09:00', '10:00'), ('Terça', '10:00', '11:00'),
  ('Terça', '13:30', '14:30'), ('Terça', '14:30', '15:30'), ('Terça', '15:30', '16:30'), ('Terça', '16:30', '17:30'),
  ('Quarta', '08:00', '09:00'), ('Quarta', '09:00', '10:00'), ('Quarta', '10:00', '11:00'),
  ('Quarta', '13:30', '14:30'), ('Quarta', '14:30', '15:30'), ('Quarta', '15:30', '16:30'), ('Quarta', '16:30', '17:30'),
  ('Quinta', '08:00', '09:00'), ('Quinta', '09:00', '10:00'), ('Quinta', '10:00', '11:00'),
  ('Quinta', '13:30', '14:30'), ('Quinta', '14:30', '15:30'), ('Quinta', '15:30', '16:30'), ('Quinta', '16:30', '17:30'),
  ('Sábado', '08:00', '10:00'), ('Sábado', '10:00', '12:00');

-- Seed default courses
INSERT INTO public.courses (name, workload, is_custom) VALUES
  ('Informática Básica', 48, false),
  ('Informática Avançada', 48, false),
  ('Excel Básico', 48, false),
  ('Excel Avançado', 48, false),
  ('Digitação', 48, false),
  ('Internet', 48, false),
  ('Manutenção de Computadores', 48, false),
  ('Design Gráfico', 48, false),
  ('Programação', 48, false);
