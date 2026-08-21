-- Discovery v2: Registry + Idempotent Reconciliation

-- Registry columns on venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES venues(id);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS aliases jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Mirror status on schools
ALTER TABLE schools ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Rejection memory
CREATE TABLE IF NOT EXISTS discovery_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text,
  url text,
  school_name text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discovery_rejections_domain_idx ON discovery_rejections(domain);

-- Backfill existing statuses from url_status
UPDATE venues SET status = 'out_of_city' WHERE url_status = 'out_of_city' AND status = 'active';
UPDATE venues SET status = 'fetch_blocked' WHERE url_status = 'fetch_blocked' AND status = 'active';

-- Mirror to schools
UPDATE schools SET status = v.status
FROM venues v WHERE schools.venue_id = v.id AND v.status != 'active';

-- RLS: anon can read discovery_rejections (for Claude to audit)
ALTER TABLE discovery_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_discovery_rejections" ON discovery_rejections
  FOR SELECT TO anon USING (true);
CREATE POLICY "service_role_all_discovery_rejections" ON discovery_rejections
  FOR ALL TO service_role USING (true) WITH CHECK (true);
