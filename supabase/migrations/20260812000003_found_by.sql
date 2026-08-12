ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS found_by jsonb DEFAULT '[]';
