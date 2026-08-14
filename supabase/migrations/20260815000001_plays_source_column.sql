ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'curated'
  CHECK (source IN ('curated', 'ai'));

ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS scraper_run_id text;

CREATE INDEX IF NOT EXISTS idx_plays_source ON public.plays(source);
