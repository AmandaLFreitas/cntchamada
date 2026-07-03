-- Add new phone column for student contact phone
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone TEXT;

-- Migrate phone-like values from house_number into phone
-- Detection: digits-only length is 10 or 11 (BR mobile/landline)
UPDATE public.students
SET phone = house_number,
    house_number = NULL
WHERE phone IS NULL
  AND house_number IS NOT NULL
  AND length(regexp_replace(house_number, '\D', '', 'g')) IN (10, 11);

-- Also seed phone from guardian_phone when phone still empty (preserves existing valid contacts)
UPDATE public.students
SET phone = guardian_phone
WHERE phone IS NULL
  AND guardian_phone IS NOT NULL
  AND length(regexp_replace(guardian_phone, '\D', '', 'g')) IN (10, 11);
