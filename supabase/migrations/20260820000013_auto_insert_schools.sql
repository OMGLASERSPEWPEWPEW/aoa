-- Auto-insert schools: add 'inserted' disposition for direct venue+school creation
ALTER TABLE public.discovery_logs
  DROP CONSTRAINT IF EXISTS discovery_logs_disposition_check;

ALTER TABLE public.discovery_logs
  ADD CONSTRAINT discovery_logs_disposition_check
  CHECK (disposition IN (
    'queued',
    'inserted',
    'blocked_aggregator',
    'already_known_venue',
    'already_in_queue',
    'insert_error'
  ));
