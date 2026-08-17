-- Fix Acting Studio Chicago: wrong address and coordinates
-- Real location: 10 W Hubbard St, River North (NOT 5955 N Broadway, Edgewater)
UPDATE public.schools
SET latitude = 41.8899, longitude = -87.6285, neighborhood = 'River North'
WHERE slug = 'acting-studio-chicago';

UPDATE public.venues
SET latitude = 41.8899, longitude = -87.6285, neighborhood = 'River North',
    address = '10 W Hubbard St, Chicago, IL 60654'
WHERE slug = 'acting-studio-chicago';

-- Fix DePaul Theatre School neighborhood
UPDATE public.schools SET neighborhood = 'Lincoln Park'
WHERE slug = 'the-theatre-school-at-depaul-university';

-- Fix DePaul Music School neighborhood
UPDATE public.schools SET neighborhood = 'Lincoln Park'
WHERE slug = 'depaul-university-school-of-music';

-- Fix Bravo Performing Arts neighborhood (Oak Park, not Chicago)
UPDATE public.schools SET neighborhood = 'Oak Park'
WHERE slug = 'bravo-performing-arts-academy';

-- Fix Bienen School neighborhood (Evanston, not Chicago)
UPDATE public.schools SET neighborhood = 'Evanston'
WHERE slug = 'bienen-school-of-music';
