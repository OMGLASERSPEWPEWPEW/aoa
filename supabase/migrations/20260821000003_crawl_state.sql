-- sv4-mig-crawl-state: resumable BFS state across invocations

CREATE TABLE IF NOT EXISTS public.crawl_state (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          uuid NOT NULL REFERENCES public.venues(id),
  domain            text NOT NULL,
  tier              smallint NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'running',
  frontier          jsonb NOT NULL DEFAULT '[]'::jsonb,
  visited           jsonb NOT NULL DEFAULT '[]'::jsonb,
  programs_partial  jsonb NOT NULL DEFAULT '[]'::jsonb,
  school_address    text,
  block_hashes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  link_score_cache  jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_used       jsonb NOT NULL DEFAULT '{}'::jsonb,
  invocation_count  int NOT NULL DEFAULT 0,
  stop_reason       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crawl_state_one_running
  ON public.crawl_state(venue_id) WHERE status = 'running';

ALTER TABLE public.crawl_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crawl_state_anon_select" ON public.crawl_state FOR SELECT USING (true);
