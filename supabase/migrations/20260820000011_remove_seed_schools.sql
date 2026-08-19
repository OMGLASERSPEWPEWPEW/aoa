-- Remove all manually seeded school data.
-- Schools should only come from the discovery pipeline (Find Schools → Promote → Scrape Classes).
DELETE FROM public.class_interest;
DELETE FROM public.class_teachers;
DELETE FROM public.class_sessions;
DELETE FROM public.schools;
UPDATE public.venue_discovery_queue SET promoted_venue_id = NULL
  WHERE promoted_venue_id IN (SELECT id FROM public.venues WHERE venue_type = 'school');
DELETE FROM public.venues WHERE venue_type = 'school';
