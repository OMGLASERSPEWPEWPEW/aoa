-- Reset scraped_at to allow re-scraping with the new two-pass pipeline
UPDATE public.venues SET scraped_at = NULL;
