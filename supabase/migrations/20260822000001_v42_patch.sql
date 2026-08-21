-- v4.2 patch: cost columns, photo persistence, url_status, address backfill

-- Cost columns on scrape_logs (currently hardcoded to 0)
ALTER TABLE scrape_logs ADD COLUMN IF NOT EXISTS cost_usd numeric;
ALTER TABLE scrape_logs ADD COLUMN IF NOT EXISTS fetches int;
ALTER TABLE scrape_logs ADD COLUMN IF NOT EXISTS pages_visited int;

-- Cost accumulator on scrape_jobs
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS total_cost_usd numeric DEFAULT 0;

-- Photo URL on crawl_state (persist og:image across invocations)
ALTER TABLE crawl_state ADD COLUMN IF NOT EXISTS photo_url text;

-- Out-of-city / fetch_blocked status on venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS url_status text;

-- Backfill schools.address from venues.address where null
UPDATE schools s SET address = v.address
  FROM venues v WHERE s.venue_id = v.id AND s.address IS NULL AND v.address IS NOT NULL;
