-- acr-mig-overrides-suggestions (1/2): field_overrides table + RLS
-- Tracks per-field admin edits so the curator pipeline respects them.

CREATE TABLE public.field_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('venue','school','class_session','event')),
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  value jsonb NOT NULL,
  previous_value jsonb,
  edited_by uuid NOT NULL REFERENCES auth.users(id),
  edited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field_name)
);

CREATE INDEX ON public.field_overrides (entity_type, entity_id);

ALTER TABLE public.field_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_overrides_admin_all" ON public.field_overrides
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
