-- Reset school/class data before scraper v4 upgrade.
-- Safe deletion order per dependency chain (docs in migration 20260820000015):
--   schools (no cascade from venues) → class_sessions (cascade) → class_teachers + class_interest (cascade)
--   venues where venue_type='school' → events + scrape_logs (cascade)

BEGIN;
DELETE FROM public.schools;
DELETE FROM public.discovery_logs;
DELETE FROM public.scrape_jobs WHERE job_type = 'class';
DELETE FROM public.venues WHERE venue_type = 'school';
COMMIT;
