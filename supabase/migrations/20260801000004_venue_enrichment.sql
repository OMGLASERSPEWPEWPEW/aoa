-- Venue enrichment: photo provenance + URL validation tracking + scrape log phase

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS photo_url_source text
    CHECK (photo_url_source IN ('og_image', 'manual')),
  ADD COLUMN IF NOT EXISTS website_url_checked_at timestamptz;

ALTER TABLE scrape_logs
  ADD COLUMN IF NOT EXISTS phase text DEFAULT 'scraping'
    CHECK (phase IN ('enrichment', 'scraping'));
