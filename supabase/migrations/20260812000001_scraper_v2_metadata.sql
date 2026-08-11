ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS extraction_status text
    DEFAULT 'partial'
    CHECK (extraction_status IN ('complete', 'partial', 'no_dates_on_site', 'dates_in_past', 'unreachable', 'budget_exhausted'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS missing_fields jsonb DEFAULT '[]';

ALTER TABLE public.scrape_logs
  ADD COLUMN IF NOT EXISTS strategy_trace jsonb;
