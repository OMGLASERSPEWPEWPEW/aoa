-- Reset scraped_at to allow re-scraping with the new TIC detail fetch node.
-- Only reset venues that have events with NULL start_date (gap venues).
UPDATE public.venues
SET scraped_at = NULL
WHERE id IN (
  SELECT DISTINCT venue_id FROM public.events
  WHERE start_date IS NULL AND source = 'scraped'
);
