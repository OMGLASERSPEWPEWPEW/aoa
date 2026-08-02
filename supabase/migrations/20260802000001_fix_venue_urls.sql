-- Fix Shattered Globe Theatre URL (shatteredglobe.org → sgtheatre.org)
UPDATE venues SET
  website_url = 'https://www.sgtheatre.org',
  calendar_url = 'https://www.sgtheatre.org'
WHERE slug = 'shattered-globe';

-- Fix A Red Orchid Theatre URL (301 redirect — drop www)
UPDATE venues SET
  website_url = 'https://aredorchidtheatre.org'
WHERE slug = 'a-red-orchid';

-- Null out Redtwist Theatre URL (DNS dead)
UPDATE venues SET
  website_url = NULL
WHERE slug = 'redtwist';
