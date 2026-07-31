-- Event scraper infrastructure: calendar URLs, provenance tracking, audit logs, cron schedule

-- Add calendar_url to venues (scraper targets this URL)
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS calendar_url text;

-- Add provenance tracking to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source text
  DEFAULT 'manual' CHECK (source IN ('manual', 'scraped'));
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS scraped_at timestamptz;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_url text;

-- Backfill existing seed events
UPDATE public.events SET source = 'manual' WHERE source IS NULL;

-- Scrape run audit log
CREATE TABLE IF NOT EXISTS public.scrape_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE,
  venue_name text,
  status text CHECK (status IN ('success', 'fetch_error', 'parse_error', 'ai_error', 'skipped')),
  events_found int DEFAULT 0,
  events_created int DEFAULT 0,
  events_updated int DEFAULT 0,
  error_message text,
  ai_input_tokens int,
  ai_output_tokens int,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

-- RLS: scrape_logs readable by authenticated users, writable only by service role
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scrape logs"
  ON public.scrape_logs FOR SELECT
  TO authenticated
  USING (true);

-- Populate calendar_url for each venue (verified July 2026)
UPDATE public.venues SET calendar_url = 'https://www.steppenwolf.org/whats-on' WHERE slug = 'steppenwolf';
UPDATE public.venues SET calendar_url = 'https://neofuturists.org/events/theinfinitewrench/' WHERE slug = 'neo-futurists';
UPDATE public.venues SET calendar_url = 'https://lookingglasstheatre.org/whats-on/season/' WHERE slug = 'lookingglass';
UPDATE public.venues SET calendar_url = 'https://www.theannoyance.com/shows' WHERE slug = 'annoyance';
UPDATE public.venues SET calendar_url = 'https://courttheatre.org/current-season/' WHERE slug = 'court-theatre';
UPDATE public.venues SET calendar_url = 'https://thedentheatre.com/calendar' WHERE slug = 'den-theatre';
UPDATE public.venues SET calendar_url = 'https://victorygardens.org/events/' WHERE slug = 'victory-gardens';
UPDATE public.venues SET calendar_url = 'https://ioimprov.com/shows/' WHERE slug = 'io-theater';
UPDATE public.venues SET calendar_url = 'https://www.collaboraction.org/event-list' WHERE slug = 'collaboraction';
UPDATE public.venues SET calendar_url = 'https://www.chicagoshakes.com/current-season/' WHERE slug = 'chicago-shakespeare';
UPDATE public.venues SET calendar_url = 'https://steeptheatre.com' WHERE slug = 'steep-theatre';
UPDATE public.venues SET calendar_url = 'https://secondcity.com/shows' WHERE slug = 'second-city';

-- Enable pg_cron and pg_net for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- pg_cron schedule: Monday 6AM UTC (midnight CST)
-- Uses pg_net to POST to the event-scraper Edge Function
SELECT cron.schedule(
  'weekly-event-scrape',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://rytjrterecygirttvtdn.supabase.co/functions/v1/event-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.scraper_secret', true)
    ),
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);
