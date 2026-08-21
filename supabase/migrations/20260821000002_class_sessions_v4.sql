-- sv4-mig-events-class-cols: richer class/section data for v4 extraction

ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS discipline text,
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS day_of_week text,
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS end_time text,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS instructor_name text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS program_name text,
  ADD COLUMN IF NOT EXISTS extraction_status text,
  ADD COLUMN IF NOT EXISTS notes text;
