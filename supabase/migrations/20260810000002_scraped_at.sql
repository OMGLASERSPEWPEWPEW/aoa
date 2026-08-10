ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS scraped_at timestamptz;
