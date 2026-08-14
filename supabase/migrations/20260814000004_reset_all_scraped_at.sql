-- Reset all scraped_at to allow full re-scrape with fixed TIC lookup
-- (lookupVenueOnTic was short-circuiting, missing Now Playing shows)
UPDATE public.venues SET scraped_at = NULL WHERE scraped_at IS NOT NULL;
