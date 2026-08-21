-- Fix: is_admin() returns NULL for unauthenticated users, bypassing NOT checks.
-- COALESCE ensures it always returns FALSE when no email matches.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() ->> 'email') = ANY(ARRAY['deric.o.ortiz@gmail.com']), false)
$$;

-- Recreate all admin RPCs with IS NOT TRUE guard (belt-and-suspenders with the COALESCE fix)

CREATE OR REPLACE FUNCTION public.apply_field_override(
  p_entity_type text, p_entity_id uuid, p_field text, p_value jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev jsonb; v_table text;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'not admin'; END IF;

  v_table := CASE p_entity_type
    WHEN 'venue' THEN 'venues' WHEN 'school' THEN 'schools'
    WHEN 'class_session' THEN 'class_sessions' WHEN 'event' THEN 'events'
    ELSE NULL END;
  IF v_table IS NULL THEN RAISE EXCEPTION 'bad entity_type %', p_entity_type; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=v_table AND column_name=p_field
  ) THEN RAISE EXCEPTION 'unknown field %.%', v_table, p_field; END IF;

  EXECUTE format('SELECT to_jsonb(t.%I) FROM public.%I t WHERE t.id=$1', p_field, v_table)
    INTO v_prev USING p_entity_id;

  EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id = $2', v_table, p_field)
    USING p_value #>> '{}', p_entity_id;

  INSERT INTO public.field_overrides
    (entity_type, entity_id, field_name, value, previous_value, edited_by)
  VALUES (p_entity_type, p_entity_id, p_field, p_value,
          COALESCE((SELECT previous_value FROM public.field_overrides
                     WHERE entity_type=p_entity_type AND entity_id=p_entity_id
                       AND field_name=p_field), v_prev),
          auth.uid())
  ON CONFLICT (entity_type, entity_id, field_name)
  DO UPDATE SET value = EXCLUDED.value, edited_by = auth.uid(), edited_at = now();

  UPDATE public.curator_suggestions SET status='dismissed'
   WHERE entity_type=p_entity_type AND entity_id=p_entity_id
     AND field_name=p_field AND status='open';
END $$;

CREATE OR REPLACE FUNCTION public.release_field_override(
  p_entity_type text, p_entity_id uuid, p_field text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'not admin'; END IF;

  DELETE FROM public.field_overrides
   WHERE entity_type = p_entity_type AND entity_id = p_entity_id AND field_name = p_field;

  UPDATE public.curator_suggestions
     SET status = 'open'
   WHERE entity_type = p_entity_type AND entity_id = p_entity_id
     AND field_name = p_field AND status = 'muted';
END $$;

CREATE OR REPLACE FUNCTION public.accept_suggestion(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sug record;
  v_table text;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'not admin'; END IF;

  SELECT * INTO v_sug FROM public.curator_suggestions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'suggestion not found'; END IF;

  v_table := CASE v_sug.entity_type
    WHEN 'venue' THEN 'venues' WHEN 'school' THEN 'schools'
    WHEN 'class_session' THEN 'class_sessions' WHEN 'event' THEN 'events'
    ELSE NULL END;
  IF v_table IS NULL THEN RAISE EXCEPTION 'bad entity_type %', v_sug.entity_type; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=v_table AND column_name=v_sug.field_name
  ) THEN RAISE EXCEPTION 'unknown field %.%', v_table, v_sug.field_name; END IF;

  EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id = $2', v_table, v_sug.field_name)
    USING v_sug.suggested_value #>> '{}', v_sug.entity_id;

  DELETE FROM public.field_overrides
   WHERE entity_type = v_sug.entity_type AND entity_id = v_sug.entity_id
     AND field_name = v_sug.field_name;

  UPDATE public.curator_suggestions SET status = 'accepted' WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.dismiss_suggestion(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_times int;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'not admin'; END IF;

  SELECT times_suggested INTO v_times FROM public.curator_suggestions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'suggestion not found'; END IF;

  IF v_times >= 2 THEN
    UPDATE public.curator_suggestions SET status = 'muted' WHERE id = p_id;
  ELSE
    UPDATE public.curator_suggestions SET status = 'dismissed' WHERE id = p_id;
  END IF;
END $$;
