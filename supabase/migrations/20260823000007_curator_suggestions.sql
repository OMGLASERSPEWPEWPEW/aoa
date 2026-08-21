-- acr-mig-overrides-suggestions (2/2): curator_suggestions table + RLS
-- Parks blocked writes so the admin sees what the curator found.

CREATE TABLE public.curator_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  suggested_value jsonb NOT NULL,
  evidence jsonb,
  times_suggested int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','accepted','dismissed','muted')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field_name)
);

CREATE INDEX ON public.curator_suggestions (entity_type, entity_id, status);

ALTER TABLE public.curator_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curator_suggestions_admin_all" ON public.curator_suggestions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
