-- Art Classes Discovery: class-specific event fields
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS instructor_name text,
  ADD COLUMN IF NOT EXISTS skill_level text
    CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all-levels', 'drop-in')),
  ADD COLUMN IF NOT EXISTS session_count int,
  ADD COLUMN IF NOT EXISTS class_format text
    CHECK (class_format IN ('ongoing', 'workshop', 'intensive', 'drop-in', 'series'));

COMMENT ON COLUMN public.events.instructor_name IS 'Primary instructor name. Null for show events.';
COMMENT ON COLUMN public.events.skill_level IS 'Required experience level for classes/workshops. Null for show events.';
COMMENT ON COLUMN public.events.session_count IS 'Number of sessions for multi-week courses. Null for single events and shows.';
COMMENT ON COLUMN public.events.class_format IS 'Temporal format of the class. Null for show events.';
