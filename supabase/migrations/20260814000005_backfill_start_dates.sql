-- Backfill start_date for events with end_date but no start_date.
-- "Thru Aug 23" means the show is running now — set start_date to today.
UPDATE public.events
SET start_date = CURRENT_DATE,
    extraction_status = CASE WHEN extraction_status = 'partial' THEN 'complete' ELSE extraction_status END,
    missing_fields = missing_fields - 'start_date'
WHERE start_date IS NULL
  AND end_date IS NOT NULL
  AND end_date >= CURRENT_DATE;
