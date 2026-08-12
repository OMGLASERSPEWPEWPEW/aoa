UPDATE public.scrape_jobs
SET status = 'failed', error = 'chain fix deployed', completed_at = now()
WHERE status = 'running';
