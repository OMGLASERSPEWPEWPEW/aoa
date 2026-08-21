-- Reset all school and class data for pipeline v2 rebuild.
--
-- Dependency chain (FK order matters):
--   venues (venue_type='school')
--     ├── events (venue_id FK, ON DELETE CASCADE)
--     ├── scrape_logs (venue_id FK, ON DELETE CASCADE)
--     └── schools (venue_id FK, NO CASCADE — must delete explicitly)
--           └── class_sessions (school_id FK, ON DELETE CASCADE)
--                 ├── class_teachers (session_id FK, ON DELETE CASCADE)
--                 └── class_interest (session_id FK, ON DELETE CASCADE)

BEGIN;

-- Step 1: Delete schools — cascades to class_sessions → class_teachers + class_interest
DELETE FROM public.schools;

-- Step 2: Clean up discovery/job logs (no FKs)
DELETE FROM public.discovery_logs;
DELETE FROM public.scrape_jobs WHERE job_type = 'class';

-- Step 3: Delete school venues — cascades to events + scrape_logs for those venues
DELETE FROM public.venues WHERE venue_type = 'school';

COMMIT;
