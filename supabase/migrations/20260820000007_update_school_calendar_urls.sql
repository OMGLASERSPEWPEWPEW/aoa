-- Update calendar URLs to point to actual class listing pages
-- The scraper's link-following will crawl deeper pages from these indexes

UPDATE public.venues SET calendar_url = 'https://www.actingstudiochicago.com/adult-acting-classes'
WHERE slug = 'acting-studio-chicago';

UPDATE public.venues SET calendar_url = 'https://www.secondcity.com/shows-events/chicago/training-center/'
WHERE slug = 'second-city-training';

UPDATE public.venues SET calendar_url = 'https://ioimprov.com/chicago/classes/'
WHERE slug = 'io-chicago';

UPDATE public.venues SET calendar_url = 'https://theannoyance.com/classes/'
WHERE slug = 'annoyance-theatre';

UPDATE public.venues SET calendar_url = 'https://www.steppenwolf.org/education/adult-programs/'
WHERE slug = 'steppenwolf-education';

UPDATE public.venues SET calendar_url = 'https://piventheatre.org/classes/'
WHERE slug = 'piven-theatre-workshop';

UPDATE public.venues SET calendar_url = 'https://www.oldtownschool.org/classes/?category=theater'
WHERE slug = 'old-town-school';

UPDATE public.venues SET calendar_url = 'https://chicagoimprovstudio.com/classes/'
WHERE slug = 'chicago-improv-studio';

-- Also fix the Acting Studio venue description to reference the correct technique
UPDATE public.venues
SET description = 'Acting training for adults using Michael Shurtleff''s Guideposts. Core program spans 4 levels from introduction through rehearsal to performance.',
    genre_tags = ARRAY['acting', 'shurtleff', 'scene-study', 'audition', 'on-camera']
WHERE slug = 'acting-studio-chicago';
