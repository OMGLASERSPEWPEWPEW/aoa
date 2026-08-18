-- Remove all fabricated/hardcoded class sessions
-- These were placeholder data from seed migration 20260820000003
-- Real data will be populated by the class-discovery scraper
DELETE FROM public.class_sessions;
