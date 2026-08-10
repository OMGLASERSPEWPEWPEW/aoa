-- Venue Discovery Pipeline: source registry, discovery queue, run logs, coverage metrics

-- 1. Enable pg_trgm for fuzzy name matching in deduplication
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Venue source registry
CREATE TABLE IF NOT EXISTS public.venue_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('directory', 'listing_site', 'google_places', 'manual')),
  base_url text NOT NULL,
  scrape_frequency text NOT NULL DEFAULT 'weekly' CHECK (scrape_frequency IN ('daily', 'weekly', 'monthly')),
  reliability_score numeric(3,2) DEFAULT 1.00,
  is_active boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.venue_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on venue_sources" ON public.venue_sources FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read venue_sources" ON public.venue_sources FOR SELECT TO authenticated USING (true);

-- 3. Discovery queue (discovered venue candidates)
CREATE TABLE IF NOT EXISTS public.venue_discovery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.venue_sources(id),
  run_id uuid,
  raw_name text NOT NULL,
  raw_address text,
  raw_website_url text,
  raw_genre_tags text[] DEFAULT '{}',
  raw_neighborhood text,
  raw_category text,
  raw_description text,
  raw_phone text,
  raw_photo_url text,
  detail_page_url text,
  dedup_status text NOT NULL DEFAULT 'pending' CHECK (dedup_status IN ('pending', 'matched', 'new', 'skipped')),
  matched_venue_id uuid REFERENCES public.venues(id),
  enrichment_status text NOT NULL DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'complete', 'failed', 'skipped')),
  enriched_latitude numeric(9,6),
  enriched_longitude numeric(9,6),
  geocode_source text,
  enriched_calendar_url text,
  enriched_website_reachable boolean,
  enriched_photo_url text,
  enriched_photo_url_source text,
  enriched_venue_type text CHECK (enriched_venue_type IN ('storefront', 'institutional', 'experimental', 'school')),
  enriched_venue_type_confidence numeric(3,2),
  enrichment_steps_failed text[] DEFAULT '{}',
  ai_input_tokens int DEFAULT 0,
  ai_output_tokens int DEFAULT 0,
  promoted boolean NOT NULL DEFAULT false,
  promoted_venue_id uuid REFERENCES public.venues(id),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (source_id, raw_name, raw_address)
);

CREATE INDEX IF NOT EXISTS idx_vdq_dedup_status ON public.venue_discovery_queue(dedup_status);
CREATE INDEX IF NOT EXISTS idx_vdq_run_id ON public.venue_discovery_queue(run_id);
CREATE INDEX IF NOT EXISTS idx_vdq_promoted ON public.venue_discovery_queue(promoted) WHERE promoted = false;

ALTER TABLE public.venue_discovery_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on venue_discovery_queue" ON public.venue_discovery_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read venue_discovery_queue" ON public.venue_discovery_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update venue_discovery_queue" ON public.venue_discovery_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Discovery run logs
CREATE TABLE IF NOT EXISTS public.discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.venue_sources(id),
  run_id uuid,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  venues_found int DEFAULT 0,
  venues_new int DEFAULT 0,
  venues_matched int DEFAULT 0,
  venues_skipped int DEFAULT 0,
  enrichment_success int DEFAULT 0,
  enrichment_failed int DEFAULT 0,
  ai_input_tokens int DEFAULT 0,
  ai_output_tokens int DEFAULT 0,
  ai_cost_usd numeric(10,6) DEFAULT 0,
  fetch_status text DEFAULT 'running' CHECK (fetch_status IN ('running', 'success', 'fetch_error', 'parse_error', 'parse_warning')),
  alert_admin boolean DEFAULT false,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_runs_source ON public.discovery_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_created ON public.discovery_runs(created_at DESC);

ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on discovery_runs" ON public.discovery_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read discovery_runs" ON public.discovery_runs FOR SELECT TO authenticated USING (true);

-- 5. Add provenance columns to venues
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS discovered_from_source_id uuid REFERENCES public.venue_sources(id);

-- 6. Trigram similarity RPC for deduplication
CREATE OR REPLACE FUNCTION public.match_venue_by_name(candidate text)
RETURNS TABLE (id uuid, name text, similarity real)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.name, similarity(v.name, candidate) AS similarity
  FROM venues v
  WHERE similarity(v.name, candidate) > 0.50
  ORDER BY similarity DESC
  LIMIT 5;
$$;

-- 7. Coverage metrics RPC
CREATE OR REPLACE FUNCTION public.get_venue_coverage_metrics()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_aoa_venues', (SELECT COUNT(*) FROM venues),
    'total_known_chicago', COALESCE((SELECT venues_found FROM discovery_runs WHERE fetch_status IN ('success', 'parse_warning') ORDER BY created_at DESC LIMIT 1), 0),
    'coverage_pct', CASE
      WHEN COALESCE((SELECT venues_found FROM discovery_runs WHERE fetch_status IN ('success', 'parse_warning') ORDER BY created_at DESC LIMIT 1), 0) = 0 THEN 0
      ELSE ROUND((SELECT COUNT(*)::numeric FROM venues) / (SELECT venues_found FROM discovery_runs WHERE fetch_status IN ('success', 'parse_warning') ORDER BY created_at DESC LIMIT 1) * 100, 1)
    END,
    'venues_with_calendar_url', (SELECT COUNT(*) FROM venues WHERE calendar_url IS NOT NULL),
    'venues_with_photo', (SELECT COUNT(*) FROM venues WHERE photo_url IS NOT NULL),
    'venues_zero_events', (SELECT COUNT(*) FROM venues v WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.venue_id = v.id)),
    'pending_in_queue', (SELECT COUNT(*) FROM venue_discovery_queue WHERE promoted = false AND dedup_status = 'new'),
    'last_discovery_run', (SELECT started_at FROM discovery_runs ORDER BY created_at DESC LIMIT 1),
    'last_run_alert', COALESCE((SELECT alert_admin FROM discovery_runs ORDER BY created_at DESC LIMIT 1), false)
  );
$$;

-- 8. Seed ChicagoPlays as the first venue source
INSERT INTO public.venue_sources (name, source_type, base_url, scrape_frequency)
VALUES ('ChicagoPlays Member Directory', 'directory', 'https://chicagoplays.com/member-theatres/', 'weekly')
ON CONFLICT DO NOTHING;
