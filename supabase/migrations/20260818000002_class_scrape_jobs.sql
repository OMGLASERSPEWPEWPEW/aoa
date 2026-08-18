-- Extend scrape_jobs to support class-discovery jobs alongside event scrape jobs

ALTER TABLE public.scrape_jobs
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'event'
    CHECK (job_type IN ('event', 'class'));

ALTER TABLE public.scrape_jobs
  ADD COLUMN IF NOT EXISTS schools_processed int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS events_created int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS events_updated int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS errors_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_schools_queued int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_schools jsonb DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_type_status ON public.scrape_jobs(job_type, status);

-- Allow service_role to update jobs (self-chaining uses service key)
CREATE POLICY "Service can update scrape jobs"
  ON public.scrape_jobs FOR UPDATE
  USING (true)
  WITH CHECK (true);
