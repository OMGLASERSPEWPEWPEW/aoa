-- acr-mig-venue-metrics: Add blocked_count, venues_missing_calendar,
-- venues_missing_photo to venue coverage metrics (explicit server-side, never client subtraction)

CREATE OR REPLACE FUNCTION public.get_venue_coverage_metrics()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_aoa_venues', (SELECT COUNT(*) FROM venues WHERE NOT public.is_source_blocked('venue', id, website_url)),
    'total_known_chicago', 150,
    'coverage_pct', ROUND(
      (SELECT COUNT(*) FROM venues WHERE NOT public.is_source_blocked('venue', id, website_url))::numeric / 150 * 100, 1
    ),
    'venues_with_calendar_url', (SELECT COUNT(*) FROM venues WHERE calendar_url IS NOT NULL AND NOT public.is_source_blocked('venue', id, website_url)),
    'venues_with_photo', (SELECT COUNT(*) FROM venues WHERE photo_url IS NOT NULL AND NOT public.is_source_blocked('venue', id, website_url)),
    'venues_zero_events', (SELECT COUNT(*) FROM venues v WHERE NOT public.is_source_blocked('venue', v.id, v.website_url) AND NOT EXISTS (SELECT 1 FROM events e WHERE e.venue_id = v.id)),
    'pending_in_queue', (SELECT COUNT(*) FROM venue_discovery_queue WHERE promoted = false AND dedup_status = 'pending'),
    'last_discovery_run', (SELECT MAX(created_at) FROM venue_discovery_queue),
    'last_run_alert', COALESCE((SELECT alert_admin FROM discovery_runs ORDER BY created_at DESC LIMIT 1), false),
    'blocked_count', (SELECT COUNT(*) FROM blocked_sources),
    'venues_missing_calendar', (SELECT COUNT(*) FROM venues WHERE calendar_url IS NULL AND NOT public.is_source_blocked('venue', id, website_url)),
    'venues_missing_photo', (SELECT COUNT(*) FROM venues WHERE photo_url IS NULL AND NOT public.is_source_blocked('venue', id, website_url))
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_venue_coverage_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_coverage_metrics() TO anon;
