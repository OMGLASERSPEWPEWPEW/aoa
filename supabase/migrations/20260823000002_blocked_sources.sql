-- acr-mig-blocked-sources: is_admin(), normalize_domain(), blocked_sources table,
-- is_source_blocked() definer helper, block/unblock RPCs, disposition CHECK extension

-- D-1: is_admin() helper — single source of truth for admin checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') = ANY(ARRAY['deric.o.ortiz@gmail.com'])
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- normalize_domain(): must match src/lib/blocklist.ts normalizeDomain() byte-for-byte
CREATE OR REPLACE FUNCTION public.normalize_domain(p_url text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
  idx int;
BEGIN
  IF p_url IS NULL THEN RETURN NULL; END IF;

  s := trim(p_url);
  IF s = '' THEN RETURN NULL; END IF;

  -- Strip scheme
  s := regexp_replace(s, '^https?://', '', 'i');

  -- Nothing left after stripping scheme
  IF s = '' OR s = '/' THEN RETURN NULL; END IF;

  -- Strip path, query, fragment
  idx := position('/' in s);
  IF idx > 0 THEN s := substring(s from 1 for idx - 1); END IF;

  -- Strip port
  idx := position(':' in s);
  IF idx > 0 THEN s := substring(s from 1 for idx - 1); END IF;

  -- Lowercase
  s := lower(s);

  -- Strip leading www.
  IF s LIKE 'www.%' THEN s := substring(s from 5); END IF;

  IF s = '' THEN RETURN NULL; END IF;
  RETURN s;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_domain(text) TO anon, authenticated;

-- blocked_sources table
CREATE TABLE public.blocked_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('domain', 'entry')),
  entity_type text NOT NULL CHECK (entity_type IN ('venue', 'school')),
  entity_id uuid,
  name_snapshot text,
  reason text NOT NULL CHECK (reason IN ('aggregator', 'closed', 'duplicate', 'not_chicago', 'other')),
  note text,
  blocked_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain)
);

CREATE INDEX idx_blocked_sources_entity ON public.blocked_sources (entity_type, entity_id);
CREATE INDEX idx_blocked_sources_domain ON public.blocked_sources (domain)
  WHERE scope = 'domain';

ALTER TABLE public.blocked_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocked_sources_admin
  ON public.blocked_sources
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- is_source_blocked(): SECURITY DEFINER helper for RLS SELECT policies
-- Without this, a plain NOT EXISTS subquery on blocked_sources evaluated as anon
-- sees zero rows (admin-only RLS) and silently filters nothing.
--
-- For venues/schools: pass (type, id, url) — checks entry + domain blocks
-- For events: pass ('venue', venue_id, NULL) — checks parent venue blocks
-- For class_sessions: pass ('school', school_id, NULL) — checks parent school blocks
CREATE OR REPLACE FUNCTION public.is_source_blocked(
  p_entity_type text,
  p_entity_id uuid,
  p_url text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked boolean;
  v_parent_url text;
BEGIN
  -- Entry-scope: exact entity match
  SELECT TRUE INTO v_blocked
  FROM public.blocked_sources
  WHERE scope = 'entry' AND entity_type = p_entity_type AND entity_id = p_entity_id
  LIMIT 1;

  IF v_blocked THEN RETURN TRUE; END IF;

  -- Domain-scope: match by URL if provided
  IF p_url IS NOT NULL THEN
    SELECT TRUE INTO v_blocked
    FROM public.blocked_sources
    WHERE scope = 'domain' AND domain = public.normalize_domain(p_url)
    LIMIT 1;

    RETURN COALESCE(v_blocked, FALSE);
  END IF;

  -- URL is NULL — look up the parent's URL for domain matching
  IF p_entity_type = 'venue' THEN
    SELECT v.website_url INTO v_parent_url FROM public.venues v WHERE v.id = p_entity_id;
  ELSIF p_entity_type = 'school' THEN
    SELECT s.url INTO v_parent_url FROM public.schools s WHERE s.id = p_entity_id;
  END IF;

  IF v_parent_url IS NOT NULL THEN
    SELECT TRUE INTO v_blocked
    FROM public.blocked_sources
    WHERE scope = 'domain' AND domain = public.normalize_domain(v_parent_url)
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_blocked, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_source_blocked(text, uuid, text) TO anon, authenticated;

-- block_source RPC
CREATE OR REPLACE FUNCTION public.block_source(
  p_entity_type text,
  p_entity_id uuid,
  p_name text,
  p_url text,
  p_scope text,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not admin';
  END IF;

  v_domain := public.normalize_domain(p_url);
  IF v_domain IS NULL THEN
    RAISE EXCEPTION 'cannot normalize URL: %', p_url;
  END IF;

  INSERT INTO public.blocked_sources (domain, scope, entity_type, entity_id, name_snapshot, reason, note, blocked_by)
  VALUES (v_domain, p_scope, p_entity_type, p_entity_id, p_name, p_reason, p_note, auth.uid())
  ON CONFLICT (domain) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'domain already blocked: %', v_domain;
  END IF;

  -- Dismiss open curator_suggestions for this entity if the table exists (ships in Phase 5)
  IF to_regclass('public.curator_suggestions') IS NOT NULL THEN
    EXECUTE format(
      'UPDATE public.curator_suggestions SET status = ''dismissed'' WHERE entity_type = %L AND entity_id = %L AND status = ''open''',
      p_entity_type, p_entity_id
    );
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_source(text, uuid, text, text, text, text, text) TO authenticated;

-- unblock_source RPC
CREATE OR REPLACE FUNCTION public.unblock_source(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not admin';
  END IF;

  DELETE FROM public.blocked_sources WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unblock_source(uuid) TO authenticated;

-- Extend discovery_logs disposition CHECK to include 'blocked_admin'
ALTER TABLE public.discovery_logs
  DROP CONSTRAINT IF EXISTS discovery_logs_disposition_check;

ALTER TABLE public.discovery_logs
  ADD CONSTRAINT discovery_logs_disposition_check
  CHECK (disposition IN (
    'queued',
    'inserted',
    'blocked_aggregator',
    'blocked_admin',
    'already_known_venue',
    'already_in_queue',
    'insert_error'
  ));
