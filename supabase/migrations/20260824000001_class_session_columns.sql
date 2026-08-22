-- Step 13: Add admin-owned columns to class_sessions for the 7b/7d class list

ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS sort_order    integer,
  ADD COLUMN IF NOT EXISTS program_group text,
  ADD COLUMN IF NOT EXISTS delivery      text CHECK (delivery IN ('in_person','online','hybrid')),
  ADD COLUMN IF NOT EXISTS deleted_at    timestamptz;

-- status already exists from 20260821000002_class_sessions_v4.sql but lacks CHECK + NOT NULL
DO $$ BEGIN
  ALTER TABLE public.class_sessions ALTER COLUMN status SET NOT NULL;
  ALTER TABLE public.class_sessions ALTER COLUMN status SET DEFAULT 'unknown';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Partial index: every list read filters deleted rows, so they don't belong in the index
CREATE INDEX IF NOT EXISTS class_sessions_school_group_order_idx
  ON public.class_sessions (school_id, program_group, sort_order)
  WHERE deleted_at IS NULL;
