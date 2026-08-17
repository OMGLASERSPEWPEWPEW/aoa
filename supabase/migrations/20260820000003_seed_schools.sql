-- F70: Seed schools from existing school venues + sample class sessions
-- Discipline mapping based on genre_tags and school focus

INSERT INTO public.schools (name, short_name, slug, latitude, longitude, neighborhood, discipline, price_band, venue_id, financial_aid, payment_plan, sliding_scale, url, photo_url)
SELECT
  v.name,
  CASE v.slug
    WHEN 'second-city-training' THEN 'SECOND CITY'
    WHEN 'io-chicago' THEN 'iO'
    WHEN 'annoyance-theatre' THEN 'ANNOYANCE'
    WHEN 'chicago-improv-studio' THEN 'CIS'
    WHEN 'acting-studio-chicago' THEN 'ACTING STUDIO'
    WHEN 'piven-theatre-workshop' THEN 'PIVEN'
    WHEN 'old-town-school' THEN 'OLD TOWN'
    WHEN 'steppenwolf-education' THEN 'STEPPENWOLF'
    WHEN 'the-theatre-school-at-depaul-university' THEN 'DEPAUL'
    ELSE left(upper(v.name), 14)
  END,
  v.slug,
  v.latitude,
  v.longitude,
  COALESCE(v.neighborhood, v.city, 'Chicago'),
  CASE v.slug
    WHEN 'second-city-training' THEN 'improv'
    WHEN 'io-chicago' THEN 'improv'
    WHEN 'annoyance-theatre' THEN 'improv'
    WHEN 'chicago-improv-studio' THEN 'improv'
    WHEN 'acting-studio-chicago' THEN 'acting'
    WHEN 'piven-theatre-workshop' THEN 'acting'
    WHEN 'old-town-school' THEN 'musical'
    WHEN 'steppenwolf-education' THEN 'acting'
    ELSE 'acting'
  END::text,
  v.price_range,
  v.id,
  CASE WHEN v.slug IN ('old-town-school', 'annoyance-theatre') THEN true ELSE false END,
  CASE WHEN v.slug IN ('second-city-training', 'steppenwolf-education') THEN true ELSE false END,
  CASE WHEN v.slug IN ('old-town-school') THEN true ELSE false END,
  v.website_url,
  v.photo_url
FROM public.venues v
WHERE v.venue_type = 'school'
ON CONFLICT (slug) DO NOTHING;

-- Seed sample class sessions (mix of enrolling and between-sessions)
-- Each school gets 2-3 sessions so the map is non-empty on day one

-- Second City
INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Improv for Everyone', 1, '2026-09-08', 'Mon 7–10pm', 8, 325, 16, 7, false, true, 'https://www.secondcity.com/training/'
FROM public.schools s WHERE s.slug = 'second-city-training';

INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Conservatory Level 2: Scene Work', 2, '2026-09-15', 'Wed 7–10pm', 8, 375, 14, 12, false, false, 'https://www.secondcity.com/training/'
FROM public.schools s WHERE s.slug = 'second-city-training';

INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, drop_in, no_experience)
SELECT s.id, 'Sketch Writing Intensive', 3, NULL, NULL, 6, 425, 12, false, false
FROM public.schools s WHERE s.slug = 'second-city-training';

-- iO Chicago
INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Harold Basics', 1, '2026-09-10', 'Tue 7–10pm', 8, 295, 16, 4, false, true, 'https://ioimprov.com/chicago/classes/'
FROM public.schools s WHERE s.slug = 'io-chicago';

INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Advanced Ensemble', 4, '2026-10-01', 'Thu 7–10pm', 8, 350, 12, 10, false, false, 'https://ioimprov.com/chicago/classes/'
FROM public.schools s WHERE s.slug = 'io-chicago';

-- Annoyance
INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Annoyance Level 1', 1, '2026-09-09', 'Tue 8–10pm', 6, 195, 18, 3, false, true, 'https://theannoyance.com/classes/'
FROM public.schools s WHERE s.slug = 'annoyance-theatre';

INSERT INTO public.class_sessions (school_id, title, level, drop_in, no_experience, price, signup_url)
SELECT s.id, 'Drop-In Jam', 1, true, true, 15, 'https://theannoyance.com/classes/'
FROM public.schools s WHERE s.slug = 'annoyance-theatre';

-- Chicago Improv Studio
INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Intro to Long-Form', 1, '2026-09-14', 'Sun 2–5pm', 8, 250, 14, 6, false, true, 'https://chicagoimprovstudio.com/classes/'
FROM public.schools s WHERE s.slug = 'chicago-improv-studio';

INSERT INTO public.class_sessions (school_id, title, level, drop_in, no_experience, price)
SELECT s.id, 'Open Practice', 1, true, true, 10
FROM public.schools s WHERE s.slug = 'chicago-improv-studio';

-- Acting Studio Chicago
INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Meisner Technique I', 1, '2026-09-08', 'Mon 7–10pm', 12, 595, 12, 8, false, true, 'https://actingstudiochicago.com/classes/'
FROM public.schools s WHERE s.slug = 'acting-studio-chicago';

INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, drop_in, no_experience, audition_required)
SELECT s.id, 'Advanced Scene Study', 4, NULL, NULL, 8, 650, 10, false, false, true
FROM public.schools s WHERE s.slug = 'acting-studio-chicago';

-- Piven
INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Story Theater Foundations', 1, '2026-09-12', 'Sat 10am–1pm', 10, 450, 14, 5, false, true, 'https://piventheatre.org/classes/'
FROM public.schools s WHERE s.slug = 'piven-theatre-workshop';

INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, drop_in, no_experience)
SELECT s.id, 'Ensemble Workshop', 3, NULL, NULL, 6, 375, 12, false, false
FROM public.schools s WHERE s.slug = 'piven-theatre-workshop';

-- Old Town School
INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Musical Theater Workshop', 1, '2026-09-11', 'Thu 7–9pm', 8, 225, 20, 9, false, true, 'https://www.oldtownschool.org/classes/'
FROM public.schools s WHERE s.slug = 'old-town-school';

INSERT INTO public.class_sessions (school_id, title, level, drop_in, no_experience, price, signup_url)
SELECT s.id, 'Storytelling Open Mic', 1, true, true, 5, 'https://www.oldtownschool.org/classes/'
FROM public.schools s WHERE s.slug = 'old-town-school';

-- Steppenwolf
INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, audition_required, signup_url)
SELECT s.id, 'Scene Study Intensive', 3, '2026-09-22', 'Mon/Wed 7–10pm', 4, 795, 10, 8, false, false, true, 'https://www.steppenwolf.org/education/'
FROM public.schools s WHERE s.slug = 'steppenwolf-education';

INSERT INTO public.class_sessions (school_id, title, level, starts_on, schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, signup_url)
SELECT s.id, 'Acting Fundamentals', 1, '2026-10-06', 'Tue 7–10pm', 8, 495, 14, 2, false, true, 'https://www.steppenwolf.org/education/'
FROM public.schools s WHERE s.slug = 'steppenwolf-education';
