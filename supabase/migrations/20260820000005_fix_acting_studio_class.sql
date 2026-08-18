-- Fix Acting Studio Chicago: teaches Shurtliff & Guideposts, not Meisner
UPDATE public.class_sessions
SET title = 'Guideposts Technique I'
WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'acting-studio-chicago')
  AND title = 'Meisner Technique I';

UPDATE public.venues
SET description = 'Acting training for adults using Shurtliff and Guideposts techniques. Programs span scene study, audition technique, and on-camera work.',
    genre_tags = ARRAY['acting', 'scene-study', 'audition', 'on-camera']
WHERE slug = 'acting-studio-chicago';
