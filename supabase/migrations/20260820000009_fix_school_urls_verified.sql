-- Fix school calendar URLs — verified with curl on 2026-08-17
-- Previous URLs returned 404, SSL errors, or timeouts

-- Second City: /shows-events/chicago/training-center/ → 404. Correct: /classes
UPDATE public.venues SET calendar_url = 'https://www.secondcity.com/classes'
WHERE slug = 'second-city-training';

-- Steppenwolf: /education/adult-programs/ → 404. Correct: /education-community
UPDATE public.venues SET calendar_url = 'https://www.steppenwolf.org/education-community'
WHERE slug = 'steppenwolf-education';

-- Piven: /classes/ → 404. Correct: /acting-classes/theatre-classes-for-adults/
UPDATE public.venues SET calendar_url = 'https://www.piventheatre.org/acting-classes/theatre-classes-for-adults/'
WHERE slug = 'piven-theatre-workshop';

-- iO: ioimprov.com/classes/ → timeout. Try the main site
UPDATE public.venues SET calendar_url = 'https://www.ioimprov.com/chicago/classes/'
WHERE slug = 'io-chicago';

-- Chicago Improv Studio: SSL cert error. Try with www
UPDATE public.venues SET calendar_url = 'https://www.chicagoimprovstudio.com/classes/'
WHERE slug = 'chicago-improv-studio';
