-- Fix calendar URLs that returned 404
UPDATE public.venues SET calendar_url = 'https://victorygardens.org/events/' WHERE slug = 'victory-gardens';
UPDATE public.venues SET calendar_url = 'https://www.collaboraction.org/event-list' WHERE slug = 'collaboraction';
