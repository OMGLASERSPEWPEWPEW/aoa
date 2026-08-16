-- Art Classes Discovery: class coverage metrics RPC
CREATE OR REPLACE FUNCTION public.get_class_coverage_metrics()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'class_venue_count', (SELECT COUNT(*) FROM venues WHERE venue_type = 'school'),
    'class_event_count', (SELECT COUNT(*) FROM events WHERE event_type IN ('class', 'workshop') AND (end_date IS NULL OR end_date >= CURRENT_DATE)),
    'class_with_instructor', (SELECT COUNT(*) FROM events WHERE event_type IN ('class', 'workshop') AND instructor_name IS NOT NULL),
    'class_with_level', (SELECT COUNT(*) FROM events WHERE event_type IN ('class', 'workshop') AND skill_level IS NOT NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO authenticated;
