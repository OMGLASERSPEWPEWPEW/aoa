-- Backfill scraped events that have no ticket_url with their venue's calendar_url
UPDATE public.events e
SET ticket_url = v.calendar_url
FROM public.venues v
WHERE e.venue_id = v.id
  AND e.source = 'scraped'
  AND e.ticket_url IS NULL
  AND v.calendar_url IS NOT NULL;
