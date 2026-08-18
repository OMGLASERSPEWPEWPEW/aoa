-- Fix calendar URLs to their final redirect targets (avoid 301 chains)
UPDATE public.venues SET calendar_url = 'https://www.actingstudiochicago.com/adult-acting-classes/'
WHERE slug = 'acting-studio-chicago';

UPDATE public.venues SET calendar_url = 'https://ioimprov.com/classes/'
WHERE slug = 'io-chicago';

UPDATE public.venues SET calendar_url = 'https://www.theannoyance.com/training'
WHERE slug = 'annoyance-theatre';
