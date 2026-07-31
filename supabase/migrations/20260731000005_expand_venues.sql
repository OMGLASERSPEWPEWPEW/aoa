-- Expand venue roster: ~25 new Chicago theater venues
-- Covers Loop theater district, storefronts, Edgewater cluster, and notable companies

INSERT INTO venues (id, name, slug, description, venue_type, address, neighborhood, latitude, longitude, price_range, website_url, genre_tags, accessibility_info, calendar_url) VALUES

-- === MAJOR INSTITUTIONS & TONY WINNERS ===

('a2000000-0000-0000-0000-000000000001', 'Goodman Theatre', 'goodman-theatre',
 'Chicago''s oldest nonprofit theater, founded 1922. Tony Award winner with two stages: the 856-seat Albert and intimate 400-seat Owen. Known for world premieres that transfer to Broadway.',
 'institutional', '170 N Dearborn St', 'Loop', 41.8846, -87.6292, '$$$',
 'https://www.goodmantheatre.org', ARRAY['drama', 'new-work', 'musical', 'classic'],
 'Fully wheelchair accessible, assistive listening, audio description, open captioning',
 'https://www.goodmantheatre.org/tickets/'),

('a2000000-0000-0000-0000-000000000002', 'Writers Theatre', 'writers-theatre',
 'Called "one of the best regional theaters in the country" by the Wall Street Journal. Intimate productions in a stunning Jeanne Gang-designed building in Glencoe. Easy Metra ride from the Loop.',
 'institutional', '325 Tudor Ct', 'Glencoe', 42.1348, -87.7578, '$$$',
 'https://www.writerstheatre.org', ARRAY['drama', 'new-work', 'adaptation', 'intimate'],
 'Fully wheelchair accessible, hearing loop, large print programs',
 'https://www.writerstheatre.org/plays-and-events'),

('a2000000-0000-0000-0000-000000000003', 'TimeLine Theatre', 'timeline-theatre',
 'History-inspired theater that connects the past to the present. Moved to a stunning new permanent venue in Uptown in 2026. Consistently excellent — Jeff Award powerhouse.',
 'institutional', '5033 N Broadway', 'Uptown', 41.9722, -87.6597, '$$',
 'https://timelinetheatre.com', ARRAY['drama', 'classic', 'adaptation', 'social-justice'],
 'Fully wheelchair accessible, assistive listening available',
 'https://timelinetheatre.com/2026-2027-season/'),

('a2000000-0000-0000-0000-000000000004', 'American Blues Theater', 'american-blues',
 'National Theatre Company Award winner. Focus on "relevant, timeless, and inclusive" American stories. Home of the beloved annual It''s a Wonderful Life: Live in Chicago! holiday show.',
 'institutional', '4809 N Ravenswood Ave', 'Lincoln Square', 41.9714, -87.6742, '$$',
 'https://americanbluestheater.com', ARRAY['drama', 'new-work', 'diverse-voices', 'classic'],
 'Wheelchair accessible, contact for specific accommodations',
 'https://americanbluestheater.com/season-41/'),

-- === LOOP THEATER DISTRICT (Broadway touring houses) ===

('a2000000-0000-0000-0000-000000000005', 'CIBC Theatre', 'cibc-theatre',
 'One of Chicago''s premier Broadway touring houses, operated by Broadway In Chicago. 3,600 seats. Where the big Broadway tours play — Hamilton, Wicked, and world premieres heading to New York.',
 'institutional', '18 W Monroe St', 'Loop', 41.8808, -87.6296, '$$$',
 'https://www.broadwayinchicago.com', ARRAY['musical', 'classic', 'spectacle'],
 'Fully wheelchair accessible, assistive listening, audio description',
 'https://www.broadwayinchicago.com/broadway-shows-in-chicago/'),

('a2000000-0000-0000-0000-000000000006', 'Cadillac Palace Theatre', 'cadillac-palace',
 'Historic 2,500-seat palace built in 1926. Ornate architecture — one of Chicago''s most beautiful venues. Hosts major Broadway touring productions. A Broadway In Chicago venue.',
 'institutional', '151 W Randolph St', 'Loop', 41.8845, -87.6332, '$$$',
 'https://www.broadwayinchicago.com', ARRAY['musical', 'classic', 'spectacle'],
 'Fully wheelchair accessible, assistive listening',
 'https://www.broadwayinchicago.com/broadway-shows-in-chicago/'),

('a2000000-0000-0000-0000-000000000007', 'James M. Nederlander Theatre', 'nederlander-theatre',
 'Named for the legendary Broadway producer, this Loop venue seats 2,200+ and hosts touring Broadway productions. A Broadway In Chicago venue.',
 'institutional', '24 W Randolph St', 'Loop', 41.8845, -87.6297, '$$$',
 'https://www.broadwayinchicago.com', ARRAY['musical', 'classic', 'spectacle'],
 'Fully wheelchair accessible, assistive listening',
 'https://www.broadwayinchicago.com/broadway-shows-in-chicago/'),

-- === UNION STOREFRONTS ===

('a2000000-0000-0000-0000-000000000008', 'Shattered Globe Theatre', 'shattered-globe',
 'Ensemble-based union theater founded in 1991. Known for visceral, emotionally charged productions of both classics and new work. Resident company at Theater Wit.',
 'storefront', '1229 W Belmont Ave', 'Lakeview', 41.9398, -87.6586, '$$',
 'https://www.shatteredglobe.org', ARRAY['drama', 'classic', 'new-work', 'ensemble'],
 'Wheelchair accessible at Theater Wit venue',
 'https://www.shatteredglobe.org'),

('a2000000-0000-0000-0000-000000000009', 'A Red Orchid Theatre', 'a-red-orchid',
 'Fiercely independent ensemble known for edgy, confrontational work in a 60-seat converted store. Founded in 1993, Jeff Award winners. If Steppenwolf is the establishment, Red Orchid is the underground.',
 'storefront', '1531 N Wells St', 'Old Town', 41.9108, -87.6345, '$$',
 'https://www.aredorchidtheatre.org', ARRAY['drama', 'new-work', 'experimental', 'intimate'],
 'Ground floor, limited wheelchair seating — call ahead',
 'https://www.aredorchidtheatre.org'),

-- === NON-UNION STOREFRONTS ===

('a2000000-0000-0000-0000-000000000010', 'Griffin Theatre', 'griffin-theatre',
 'Non-union storefront specializing in literary adaptations and ensemble storytelling. Part of the Edgewater theater cluster. Known for ambitious work on modest budgets.',
 'storefront', '5404 N Clark St', 'Edgewater', 41.9803, -87.6685, '$',
 'https://www.griffintheatre.com', ARRAY['adaptation', 'drama', 'ensemble', 'new-work'],
 'Contact venue for accessibility information',
 'https://www.griffintheatre.com/chicago-productions'),

('a2000000-0000-0000-0000-000000000011', 'Jackalope Theatre', 'jackalope-theatre',
 'Non-union company creating new work that challenges perspectives. Part of the Edgewater cluster. Punches above its weight with bold storytelling and emerging playwrights.',
 'storefront', '5917 N Broadway', 'Edgewater', 41.9890, -87.6599, '$',
 'https://www.jackalopetheatre.org', ARRAY['new-work', 'drama', 'diverse-voices'],
 'Contact venue for accessibility information',
 'https://www.jackalopetheatre.org/2025-2026'),

('a2000000-0000-0000-0000-000000000012', 'Redtwist Theatre', 'redtwist-theatre',
 'Ultra-intimate 40-seat storefront where you''re practically on stage with the actors. Non-union. Part of the Edgewater cluster. Known for raw, unfiltered performances.',
 'storefront', '1044 W Bryn Mawr Ave', 'Edgewater', 41.9833, -87.6580, '$',
 'https://www.redtwisttheatre.com', ARRAY['drama', 'intimate', 'new-work', 'classic'],
 'Small venue, limited accessibility — call ahead',
 'https://www.redtwisttheatre.com'),

-- === OFF-LOOP / ADDITIONAL STOREFRONTS ===

('a2000000-0000-0000-0000-000000000013', 'Trap Door Theatre', 'trap-door-theatre',
 'European-influenced experimental theater in a converted Bucktown storefront. Produces daring international works rarely seen in the US. The most adventurous small theater in Chicago.',
 'experimental', '1655 W Cortland St', 'Bucktown', 41.9160, -87.6714, '$',
 'https://www.trapdoortheatre.com', ARRAY['experimental', 'international', 'drama', 'adaptation'],
 'Ground floor accessible',
 'https://www.trapdoortheatre.com/season-33/'),

('a2000000-0000-0000-0000-000000000014', 'Strawdog Theatre', 'strawdog-theatre',
 'Collaborative storefront ensemble creating immersive, physically driven theater. Relocated to the Factory Theater. Known for ambitious adaptations and original devised work.',
 'storefront', '4541 N Ravenswood Ave', 'North Center', 41.9637, -87.6743, '$',
 'https://strawdog.org', ARRAY['devised', 'adaptation', 'physical-theater', 'immersive'],
 'Contact venue for accessibility information',
 'https://strawdog.org'),

('a2000000-0000-0000-0000-000000000015', 'Raven Theatre', 'raven-theatre',
 'Edgewater anchor venue with two stages. Specializes in classic American drama and literary adaptations. Home to a thriving youth education program.',
 'storefront', '6157 N Clark St', 'Edgewater', 41.9926, -87.6686, '$',
 'https://www.raventheatre.com', ARRAY['classic', 'drama', 'adaptation', 'community'],
 'Main stage wheelchair accessible, call for studio accessibility',
 'https://www.raventheatre.com/season44/'),

('a2000000-0000-0000-0000-000000000016', 'Rivendell Theatre Ensemble', 'rivendell-theatre',
 'All-women ensemble creating theater by, for, and about women. Jeff Award winners. Part of the Edgewater cluster. Celebrating 30th anniversary season.',
 'storefront', '5779 N Ridge Ave', 'Edgewater', 41.9870, -87.6705, '$',
 'https://www.rivendelltheatre.org', ARRAY['drama', 'new-work', 'diverse-voices', 'intimate'],
 'Contact venue for accessibility information',
 'https://www.rivendelltheatre.org/copy-of-events'),

-- === ADDITIONAL NOTABLE COMPANIES ===

('a2000000-0000-0000-0000-000000000017', 'Porchlight Music Theatre', 'porchlight-music',
 'Chicago''s premier center for music theater. Produces reimagined classics and new musicals with Chicago grit. Also runs the acclaimed Porchlight Revisits series exploring lesser-known musicals.',
 'storefront', '4200 W Diversey Ave', 'Hermosa', 41.9320, -87.7292, '$$',
 'https://porchlightmusictheatre.org', ARRAY['musical', 'classic', 'revival', 'new-work'],
 'Wheelchair accessible, assistive listening available',
 'https://porchlightmusictheatre.org/2026-2027-season/'),

('a2000000-0000-0000-0000-000000000018', 'Theater Wit', 'theater-wit',
 'Three-stage contemporary theater on Belmont. Known for smart, modern productions and hosting resident companies like Shattered Globe. Home to some of Chicago''s sharpest new work.',
 'storefront', '1229 W Belmont Ave', 'Lakeview', 41.9398, -87.6586, '$$',
 'https://www.theaterwit.org', ARRAY['drama', 'comedy', 'new-work', 'adaptation'],
 'Wheelchair accessible, elevator to all stages',
 'https://www.theaterwit.org/plays/2026/'),

('a2000000-0000-0000-0000-000000000019', 'Northlight Theatre', 'northlight-theatre',
 'Major suburban theater in Skokie producing top-tier professional work. Frequent world premieres and Chicago premieres. A short CTA ride from the city.',
 'institutional', '9501 Skokie Blvd', 'Skokie', 42.0602, -87.7373, '$$$',
 'https://www.northlight.org', ARRAY['drama', 'new-work', 'classic', 'musical'],
 'Fully wheelchair accessible, assistive listening, open captioning select performances',
 'https://www.northlight.org/seasons/2023-2024/'),

('a2000000-0000-0000-0000-000000000020', 'About Face Theatre', 'about-face-theatre',
 'The Midwest''s largest LGBTQ+ theater company. Produces work that advances the national dialogue on gender and sexuality. Essential Chicago institution.',
 'storefront', '1222 W Wilson Ave', 'Uptown', 41.9653, -87.6590, '$$',
 'https://aboutfacetheatre.com', ARRAY['drama', 'new-work', 'diverse-voices', 'community'],
 'Venue accessibility varies by production — check website',
 'https://aboutfacetheatre.com/news-archive/season32/'),

('a2000000-0000-0000-0000-000000000021', 'Black Ensemble Theater', 'black-ensemble',
 'African-American cultural institution celebrating Black history through original musicals and plays. Founded by Jackie Taylor in 1976. Beautiful purpose-built venue in Uptown.',
 'institutional', '4450 N Clark St', 'Uptown', 41.9623, -87.6687, '$$',
 'https://blackensembletheater.org', ARRAY['musical', 'drama', 'diverse-voices', 'community'],
 'Fully wheelchair accessible',
 'https://blackensembletheater.org'),

('a2000000-0000-0000-0000-000000000022', 'Lifeline Theatre', 'lifeline-theatre',
 'Rogers Park company specializing in literary adaptations — from epic novels to picture books. Strong family programming alongside ambitious adult work. A neighborhood treasure since 1983.',
 'storefront', '6912 N Glenwood Ave', 'Rogers Park', 42.0082, -87.6652, '$',
 'https://www.lifelinetheatre.com', ARRAY['adaptation', 'drama', 'community', 'family'],
 'Wheelchair accessible, contact for specific needs',
 'https://lifelinetheatre.com/2026-27-season/'),

('a2000000-0000-0000-0000-000000000023', 'Babes With Blades', 'babes-with-blades',
 'Stage combat-focused company featuring women and non-binary performers. Bold, physical, feminist storytelling. Part of the Edgewater theater cluster.',
 'storefront', '5765 N Ridge Ave', 'Edgewater', 41.9867, -87.6704, '$',
 'https://www.babeswithblades.org', ARRAY['physical-theater', 'drama', 'new-work', 'diverse-voices'],
 'Contact venue for accessibility information',
 'https://www.babeswithblades.org'),

('a2000000-0000-0000-0000-000000000024', 'Teatro Vista', 'teatro-vista',
 'Largest Latino theater in the Midwest. Produces bold new work and classic plays that explore the Latinx experience. Essential for understanding Chicago''s full theatrical landscape.',
 'storefront', '773 N Milwaukee Ave', 'West Town', 41.8953, -87.6708, '$$',
 'https://www.teatrovista.org', ARRAY['drama', 'new-work', 'diverse-voices', 'community'],
 'Venue accessibility varies by production',
 'https://www.teatrovista.org'),

('a2000000-0000-0000-0000-000000000025', 'Theo Ubique Cabaret Theatre', 'theo-ubique',
 'Intimate cabaret-style musical theater where the audience sits at tables inches from the performers. BYOB. Reimagines classic musicals in a totally unique format.',
 'storefront', '721 Howard St', 'Evanston', 42.0194, -87.6890, '$$',
 'https://theo-u.com', ARRAY['musical', 'intimate', 'revival', 'cabaret'],
 'Contact venue for accessibility — intimate space with limited mobility access',
 'https://theo-u.com/underdog/')

ON CONFLICT (slug) DO NOTHING;
