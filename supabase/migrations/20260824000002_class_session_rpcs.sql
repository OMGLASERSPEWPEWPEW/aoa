-- Step 17a: RPCs for class session admin operations

-- Reorder within (or across) groups in one statement
CREATE OR REPLACE FUNCTION public.reorder_class_sessions(
  p_school_id uuid,
  p_moves jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not admin'; END IF;

  UPDATE public.class_sessions cs
     SET sort_order    = (m.sort_order)::integer,
         program_group = COALESCE(m.program_group, cs.program_group)
    FROM jsonb_to_recordset(p_moves)
         AS m(id uuid, sort_order integer, program_group text)
   WHERE cs.id = m.id
     AND cs.school_id = p_school_id;
END $$;

-- Soft-delete: set deleted_at, dismiss open suggestions
CREATE OR REPLACE FUNCTION public.soft_delete_class_session(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  UPDATE public.class_sessions SET deleted_at = now() WHERE id = p_id;
  UPDATE public.curator_suggestions SET status = 'dismissed'
   WHERE entity_type = 'class_session' AND entity_id = p_id AND status = 'open';
END $$;

-- Restore: clear deleted_at
CREATE OR REPLACE FUNCTION public.restore_class_session(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  UPDATE public.class_sessions SET deleted_at = NULL WHERE id = p_id;
END $$;

-- Add by hand: insert row + fan-out field_overrides for every supplied key
CREATE OR REPLACE FUNCTION public.add_class_session_by_hand(
  p_school_id uuid,
  p_payload jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_key text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not admin'; END IF;

  INSERT INTO public.class_sessions (
    school_id, title, level, status, source_url
  ) VALUES (
    p_school_id,
    COALESCE(p_payload->>'title', 'New Class'),
    COALESCE((p_payload->>'level')::integer, 1),
    'unknown',
    'manual'
  ) RETURNING id INTO v_id;

  FOR v_key IN SELECT jsonb_object_keys(p_payload)
  LOOP
    INSERT INTO public.field_overrides (entity_type, entity_id, field_name, value, edited_by)
    VALUES ('class_session', v_id, v_key, p_payload->v_key, auth.uid())
    ON CONFLICT (entity_type, entity_id, field_name)
    DO UPDATE SET value = EXCLUDED.value, edited_by = EXCLUDED.edited_by, edited_at = now();
  END LOOP;

  RETURN v_id;
END $$;
