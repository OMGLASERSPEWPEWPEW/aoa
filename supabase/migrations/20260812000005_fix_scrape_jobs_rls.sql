CREATE POLICY "Service role can update scrape jobs" ON public.scrape_jobs FOR UPDATE USING (true);

UPDATE public.scrape_jobs
SET status = 'failed', error = 'self-chain broken', completed_at = now()
WHERE status = 'running';
