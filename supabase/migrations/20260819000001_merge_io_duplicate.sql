-- FR-5: Merge iO Theater duplicate into iO Chicago
-- Pre-condition: io-theater has a schools row (slug: io-theater) but 0 class_sessions
-- Safe to delete schools row then venue row

-- Delete the orphan schools row first (FK to venues)
DELETE FROM public.schools
WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'io-theater');

-- Delete scrape_logs referencing io-theater
DELETE FROM public.scrape_logs
WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'io-theater');

-- Delete events referencing io-theater
DELETE FROM public.events
WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'io-theater');

-- Clear venue_discovery_queue references
UPDATE public.venue_discovery_queue
SET matched_venue_id = NULL
WHERE matched_venue_id = (SELECT id FROM public.venues WHERE slug = 'io-theater');

-- Now safe to delete the venue
DELETE FROM public.venues WHERE slug = 'io-theater';

-- Ensure io-chicago has the correct calendar_url
UPDATE public.venues
SET calendar_url = 'https://www.ioimprov.com/chicago/classes/'
WHERE slug = 'io-chicago'
  AND calendar_url IS DISTINCT FROM 'https://www.ioimprov.com/chicago/classes/';
