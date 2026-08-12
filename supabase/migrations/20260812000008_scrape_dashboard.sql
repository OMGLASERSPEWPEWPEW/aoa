ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS recent_venues jsonb DEFAULT '[]';
