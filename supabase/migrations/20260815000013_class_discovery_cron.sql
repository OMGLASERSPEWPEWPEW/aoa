-- Art Classes Discovery: weekly cron trigger for class-discovery Edge Function
SELECT cron.schedule(
  'class-discovery-weekly',
  '0 13 * * 1',  -- Mondays 7 AM CST = 13:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://rytjrterecygirttvtdn.supabase.co/functions/v1/class-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scraper-key', current_setting('app.settings.scraper_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
