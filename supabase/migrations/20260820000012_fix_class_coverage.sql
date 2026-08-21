-- Fix class coverage metrics: only count events from school venues, not stray workshops from theaters
-- Also reclassify scraped workshop/class events from non-school venues back to 'show'

-- Reclassify stray class/workshop events from non-school venues
UPDATE public.events
SET event_type = 'show'
WHERE event_type IN ('class', 'workshop')
  AND venue_id NOT IN (SELECT id FROM public.venues WHERE venue_type = 'school');

-- Fix RPC to scope metrics to school venues only
CREATE OR REPLACE FUNCTION public.get_class_coverage_metrics()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'class_venue_count', (SELECT COUNT(*) FROM venues WHERE venue_type = 'school'),
    'class_event_count', (
      SELECT COUNT(*) FROM events e
      JOIN venues v ON e.venue_id = v.id
      WHERE v.venue_type = 'school'
        AND e.event_type IN ('class', 'workshop')
    ),
    'class_with_instructor', (
      SELECT COUNT(*) FROM events e
      JOIN venues v ON e.venue_id = v.id
      WHERE v.venue_type = 'school'
        AND e.event_type IN ('class', 'workshop')
        AND e.instructor_name IS NOT NULL
    ),
    'class_with_level', (
      SELECT COUNT(*) FROM events e
      JOIN venues v ON e.venue_id = v.id
      WHERE v.venue_type = 'school'
        AND e.event_type IN ('class', 'workshop')
        AND e.skill_level IS NOT NULL
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO anon;
