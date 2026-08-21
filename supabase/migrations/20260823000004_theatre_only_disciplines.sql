-- acr-mig-disciplines: narrow discipline CHECK to theatre-only values
-- Reassign first (before constraint), then narrow the CHECK

-- Reassign any non-theatre disciplines to 'acting' (the fallback)
UPDATE public.schools
SET discipline = 'acting'
WHERE discipline NOT IN ('improv', 'acting');

-- Drop old CHECK and add narrow one
ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_discipline_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_discipline_check
  CHECK (discipline IN ('improv', 'acting'));
