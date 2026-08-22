-- F91: scope-partial uniqueness for blocked_sources
-- Entry blocks no longer occupy the domain slot.

-- Drop the unconditional unique constraint on domain
ALTER TABLE public.blocked_sources DROP CONSTRAINT blocked_sources_domain_key;

-- Partial unique: one domain block per domain
CREATE UNIQUE INDEX blocked_sources_domain_uq ON public.blocked_sources (domain) WHERE scope = 'domain';

-- Partial unique: one entry block per entity
CREATE UNIQUE INDEX blocked_sources_entry_uq ON public.blocked_sources (entity_type, entity_id) WHERE scope = 'entry';

-- Replace block_source to conflict per scope
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

  IF p_scope = 'domain' THEN
    INSERT INTO public.blocked_sources (domain, scope, entity_type, entity_id, name_snapshot, reason, note, blocked_by)
    VALUES (v_domain, 'domain', p_entity_type, p_entity_id, p_name, p_reason, p_note, auth.uid())
    ON CONFLICT (domain) WHERE scope = 'domain' DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'domain already blocked: %', v_domain;
    END IF;
  ELSIF p_scope = 'entry' THEN
    INSERT INTO public.blocked_sources (domain, scope, entity_type, entity_id, name_snapshot, reason, note, blocked_by)
    VALUES (v_domain, 'entry', p_entity_type, p_entity_id, p_name, p_reason, p_note, auth.uid())
    ON CONFLICT (entity_type, entity_id) WHERE scope = 'entry' DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'entry already blocked';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid scope: %', p_scope;
  END IF;

  IF to_regclass('public.curator_suggestions') IS NOT NULL THEN
    EXECUTE format(
      'UPDATE public.curator_suggestions SET status = ''dismissed'' WHERE entity_type = %L AND entity_id = %L AND status = ''open''',
      p_entity_type, p_entity_id
    );
  END IF;

  RETURN v_id;
END;
$$;
