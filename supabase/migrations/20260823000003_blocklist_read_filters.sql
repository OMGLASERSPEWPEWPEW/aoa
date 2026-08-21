-- acr-mig-read-filters: Amend public SELECT policies on venues, events, schools,
-- class_sessions to hide blocked entities via the is_source_blocked() definer helper.
-- Also update get_class_coverage_metrics to exclude blocked schools.

-- Venues: hide blocked venues from public reads
DROP POLICY IF EXISTS "Anyone can read venues" ON public.venues;
CREATE POLICY "Anyone can read venues"
  ON public.venues FOR SELECT
  USING (NOT public.is_source_blocked('venue', id, website_url));

-- Events: hide events whose parent venue is blocked
DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
CREATE POLICY "Anyone can read events"
  ON public.events FOR SELECT
  USING (NOT public.is_source_blocked('venue', venue_id, NULL));

-- Schools: hide blocked schools from public reads
DROP POLICY IF EXISTS "schools_select" ON public.schools;
CREATE POLICY "schools_select"
  ON public.schools FOR SELECT
  USING (NOT public.is_source_blocked('school', id, url));

-- Class sessions: hide sessions whose parent school is blocked
DROP POLICY IF EXISTS "class_sessions_select" ON public.class_sessions;
CREATE POLICY "class_sessions_select"
  ON public.class_sessions FOR SELECT
  USING (NOT public.is_source_blocked('school', school_id, NULL));

-- Update class coverage metrics to exclude blocked schools
CREATE OR REPLACE FUNCTION public.get_class_coverage_metrics()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'school_count',
      (SELECT COUNT(*) FROM schools s
       WHERE NOT EXISTS (SELECT 1 FROM blocked_sources bs
         WHERE (bs.scope = 'entry' AND bs.entity_type = 'school' AND bs.entity_id = s.id)
            OR (bs.scope = 'domain' AND s.url IS NOT NULL AND bs.domain = normalize_domain(s.url)))),
    'schools_never_curated',
      (SELECT COUNT(*) FROM schools s
       WHERE NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.school_id = s.id)
         AND NOT EXISTS (SELECT 1 FROM blocked_sources bs
           WHERE (bs.scope = 'entry' AND bs.entity_type = 'school' AND bs.entity_id = s.id)
              OR (bs.scope = 'domain' AND s.url IS NOT NULL AND bs.domain = normalize_domain(s.url)))),
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
             WHERE NOT EXISTS (SELECT 1 FROM blocked_sources bs
               WHERE (bs.scope = 'entry' AND bs.entity_type = 'school' AND bs.entity_id = s.id)
                  OR (bs.scope = 'domain' AND s.url IS NOT NULL AND bs.domain = normalize_domain(s.url)))
             GROUP BY s.discipline) d),
    'last_curated_at',
      (SELECT MAX(scraped_at) FROM class_sessions)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO anon;
