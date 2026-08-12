CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  venues_processed int DEFAULT 0,
  events_found int DEFAULT 0,
  total_venues int DEFAULT 0,
  current_venue text,
  last_strategy text,
  error text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON public.scrape_jobs(status);

ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read scrape jobs" ON public.scrape_jobs FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert scrape jobs" ON public.scrape_jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.trigger_next_scrape_batch(p_job_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://rytjrterecygirttvtdn.supabase.co/functions/v1/event-scrape-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scraper-key', current_setting('app.settings.scraper_secret', true)
    ),
    body := jsonb_build_object('job_id', p_job_id::text)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
