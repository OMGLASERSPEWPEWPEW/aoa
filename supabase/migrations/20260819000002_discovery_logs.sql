-- FR-4: Discovery pipeline observability logging
CREATE TABLE IF NOT EXISTS public.discovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  query text NOT NULL,
  raw_url text NOT NULL,
  raw_title text,
  domain text NOT NULL,
  disposition text NOT NULL CHECK (disposition IN (
    'queued',
    'blocked_aggregator',
    'already_known_venue',
    'already_in_queue',
    'insert_error'
  )),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_logs_run_id ON public.discovery_logs (run_id);
CREATE INDEX idx_discovery_logs_created_at ON public.discovery_logs (created_at);

ALTER TABLE public.discovery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on discovery_logs"
  ON public.discovery_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read discovery_logs"
  ON public.discovery_logs FOR SELECT TO authenticated USING (true);

-- FR-6: Add rejected_at to venue_discovery_queue for reject flow
ALTER TABLE public.venue_discovery_queue
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- FR-6: Admin write policies for venue promotion
CREATE POLICY "Admin can insert venues"
  ON public.venues FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'deric.o.ortiz@gmail.com');

CREATE POLICY "Admin can insert schools"
  ON public.schools FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'deric.o.ortiz@gmail.com');
