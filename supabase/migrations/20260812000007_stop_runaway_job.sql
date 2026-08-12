UPDATE public.scrape_jobs
SET status = 'cancelled', error = 'runaway loop — gap query had no scraped_at filter', completed_at = now()
WHERE status = 'running';
