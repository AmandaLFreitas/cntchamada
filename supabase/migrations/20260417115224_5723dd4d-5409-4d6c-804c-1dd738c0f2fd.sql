-- Migrar alunos do slot 08:00-10:00 (2h) para 08:00-09:00 e 09:00-10:00 (1h cada)
INSERT INTO student_schedules (student_id, time_slot_id, student_course_id)
SELECT student_id, 'df2aee39-94fd-4c3b-b1d1-364afa697e74'::uuid, student_course_id
FROM student_schedules
WHERE time_slot_id = '006dddd0-09bf-43db-997a-fe4bb408e651'
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, time_slot_id, student_course_id)
SELECT student_id, 'c6ff9776-2464-4c91-bade-51fc4716b03b'::uuid, student_course_id
FROM student_schedules
WHERE time_slot_id = '006dddd0-09bf-43db-997a-fe4bb408e651'
ON CONFLICT DO NOTHING;

-- Migrar alunos do slot 10:00-12:00 (2h) para 10:00-11:00 e 11:00-12:00 (1h cada)
INSERT INTO student_schedules (student_id, time_slot_id, student_course_id)
SELECT student_id, '4e0a8b21-8462-411c-84d6-e71b466e07f9'::uuid, student_course_id
FROM student_schedules
WHERE time_slot_id = 'd62d7144-25b6-4c1a-ab7b-23af9965f3c3'
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, time_slot_id, student_course_id)
SELECT student_id, 'f5ec4efc-f7d7-4bad-890f-023f2d16ad28'::uuid, student_course_id
FROM student_schedules
WHERE time_slot_id = 'd62d7144-25b6-4c1a-ab7b-23af9965f3c3'
ON CONFLICT DO NOTHING;

-- Garantir que TODOS alunos do 08-09 também estejam no 09-10
INSERT INTO student_schedules (student_id, time_slot_id, student_course_id)
SELECT student_id, 'c6ff9776-2464-4c91-bade-51fc4716b03b'::uuid, student_course_id
FROM student_schedules
WHERE time_slot_id = 'df2aee39-94fd-4c3b-b1d1-364afa697e74'
ON CONFLICT DO NOTHING;

-- Remover schedules e attendance dos slots de 2h antes de deletar
DELETE FROM student_schedules WHERE time_slot_id IN ('006dddd0-09bf-43db-997a-fe4bb408e651','d62d7144-25b6-4c1a-ab7b-23af9965f3c3');
DELETE FROM attendance WHERE time_slot_id IN ('006dddd0-09bf-43db-997a-fe4bb408e651','d62d7144-25b6-4c1a-ab7b-23af9965f3c3');

-- Remover slots de 2h
DELETE FROM time_slots WHERE id IN ('006dddd0-09bf-43db-997a-fe4bb408e651','d62d7144-25b6-4c1a-ab7b-23af9965f3c3');