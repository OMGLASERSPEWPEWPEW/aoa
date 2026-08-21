-- acr-class-rpc-fix: Rewrite class coverage metrics against class_sessions (not events)
-- Keys match ClassCoverageMetrics interface exactly (curated naming)

CREATE OR REPLACE FUNCTION public.get_class_coverage_metrics()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'school_count',
      (SELECT COUNT(*) FROM schools),
    'schools_never_curated',
      (SELECT COUNT(*) FROM schools s
       WHERE NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.school_id = s.id)),
    'session_count',
      (SELECT COUNT(*) FROM class_sessions),
    'sessions_enrolling',
      (SELECT COUNT(*) FROM class_sessions WHERE starts_on >= CURRENT_DATE),
    'with_start_date',
      (SELECT COUNT(*) FROM class_sessions WHERE starts_on IS NOT NULL),
    'with_price',
      (SELECT COUNT(*) FROM class_sessions WHERE price IS NOT NULL),
    'with_level',
      (SELECT COUNT(*) FROM class_sessions WHERE level IS NOT NULL),
    'with_teacher',
      (SELECT COUNT(DISTINCT cs.id) FROM class_sessions cs
       WHERE EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.session_id = cs.id)),
    'by_discipline',
      (SELECT COALESCE(json_object_agg(d.discipline, d.cnt), '{}'::json)
       FROM (SELECT s.discipline, COUNT(*) AS cnt
             FROM schools s
             GROUP BY s.discipline) d),
    'last_curated_at',
      (SELECT MAX(scraped_at) FROM class_sessions)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO anon;
