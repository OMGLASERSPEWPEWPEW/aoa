-- Fix garbage URLs: strip trailing [digits from website_url and calendar_url
UPDATE public.venues
SET website_url = regexp_replace(website_url, '\[\d*$', '')
WHERE website_url ~ '\[\d*$';

UPDATE public.venues
SET calendar_url = regexp_replace(calendar_url, '\[\d*$', '')
WHERE calendar_url ~ '\[\d*$';

UPDATE public.schools
SET url = regexp_replace(url, '\[\d*$', '')
WHERE url ~ '\[\d*$';

-- Fix domain-name venues: humanize names where name looks like a domain
UPDATE public.venues SET name = 'Acting Studio Chicago', slug = 'acting-studio-chicago' WHERE slug = 'actingstudiochicago-com';
UPDATE public.venues SET name = 'The Path Acting Studio', slug = 'the-path-acting-studio' WHERE slug = 'thepathactingstudio-com';
UPDATE public.venues SET name = 'Home Comedy Theater', slug = 'home-comedy-theater' WHERE slug = 'homecomedytheater-com';
UPDATE public.venues SET name = 'The Artistic Home', slug = 'the-artistic-home' WHERE slug = 'theartistichome-org';
UPDATE public.venues SET name = 'Jamie Olah', slug = 'jamie-olah' WHERE slug = 'jamieolah-com';
UPDATE public.venues SET name = 'Black Box Acting', slug = 'black-box-acting' WHERE slug = 'blackboxacting-com';
UPDATE public.venues SET name = 'Green Shirt Studio', slug = 'green-shirt-studio' WHERE slug = 'greenshirtstudio-com';
UPDATE public.venues SET name = 'iO Improv', slug = 'io-improv' WHERE slug = 'ioimprov-com';
UPDATE public.venues SET name = 'Pro Actors Studio', slug = 'pro-actors-studio' WHERE slug = 'proactorsstudio-com';
UPDATE public.venues SET name = 'The Revival', slug = 'the-revival' WHERE slug = 'the-revival-com';
UPDATE public.venues SET name = 'Lily Roze Studios', slug = 'lily-roze-studios' WHERE slug = 'lilyrozestudios-com';
UPDATE public.venues SET name = 'Douglas Farwell Studio', slug = 'douglas-farwell-studio' WHERE slug = 'douglasfarwellstudio-com';
UPDATE public.venues SET name = 'Vagabond School', slug = 'vagabond-school' WHERE slug = 'vagabondschool-com';
UPDATE public.venues SET name = 'Chris Thatcher', slug = 'chris-thatcher' WHERE slug = 'christhatcher-com';
UPDATE public.venues SET name = 'Invictus Theatre Co', slug = 'invictus-theatre-co' WHERE slug = 'invictustheatreco-com';
UPDATE public.venues SET name = 'Old Town School', slug = 'old-town-school' WHERE slug = 'oldtownschool-org';

-- Update matching schools table entries
UPDATE public.schools s SET name = v.name, slug = v.slug
FROM public.venues v
WHERE s.venue_id = v.id AND s.name != v.name;
