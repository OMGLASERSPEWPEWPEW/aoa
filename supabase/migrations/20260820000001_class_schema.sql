-- F70: First-class schools and class sessions tables
-- Replaces the event-on-venue pattern with dedicated entities per design spec v4

CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text NOT NULL CHECK (length(short_name) <= 14),
  slug text UNIQUE NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  neighborhood text NOT NULL,
  discipline text NOT NULL CHECK (discipline IN ('improv', 'acting', 'writing', 'musical', 'devised', 'youth')),
  price_band text CHECK (price_band IN ('$', '$$', '$$$')),
  venue_id uuid REFERENCES public.venues(id),
  financial_aid boolean NOT NULL DEFAULT false,
  payment_plan boolean NOT NULL DEFAULT false,
  sliding_scale boolean NOT NULL DEFAULT false,
  url text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  starts_on date,
  schedule text,
  weeks int,
  price numeric,
  seats_total int,
  seats_taken int,
  drop_in boolean NOT NULL DEFAULT false,
  no_experience boolean NOT NULL DEFAULT false,
  audition_required boolean NOT NULL DEFAULT false,
  prerequisite text,
  signup_url text,
  scraped_at timestamptz,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.class_sessions (school_id, starts_on);

-- artist_id FK added when F34 (artists table) ships
CREATE TABLE public.class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  artist_id uuid,
  name text NOT NULL,
  credential text,
  photo_url text
);
CREATE INDEX ON public.class_teachers (session_id);

CREATE TABLE public.class_interest (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'watching'
    CHECK (status IN ('watching', 'held', 'enrolled', 'took_it')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id)
);
