-- RPC: get_events_per_venue
-- Returns aggregated event counts per venue.
-- SECURITY INVOKER: blocked venues' events excluded by caller's RLS context.

CREATE OR REPLACE FUNCTION public.get_events_per_venue()
RETURNS TABLE(venue_id uuid, event_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT venue_id, count(*) AS event_count
  FROM events
  GROUP BY venue_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_events_per_venue() TO authenticated;
