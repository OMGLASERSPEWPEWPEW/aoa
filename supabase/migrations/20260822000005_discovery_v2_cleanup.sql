-- Discovery v2: One-time registry cleanup
-- Reconciles the live school set against known issues from 8/21 audit

-- 1. Mark loopchicago "The Revival" as duplicate of the-revival.com row
UPDATE venues SET
  status = 'duplicate',
  duplicate_of = (SELECT id FROM venues WHERE website_url ILIKE '%the-revival.com%' LIMIT 1)
WHERE website_url ILIKE '%loopchicago.com%'
  AND name ILIKE '%revival%'
  AND (SELECT id FROM venues WHERE website_url ILIKE '%the-revival.com%' LIMIT 1) IS NOT NULL;

-- 2. Reject backstage "Chicago Actors Studio" (aggregator listicle, not the real school)
UPDATE venues SET status = 'rejected'
WHERE website_url ILIKE '%backstage.com%' AND name ILIKE '%Chicago Actors Studio%';

INSERT INTO discovery_rejections (domain, url, school_name, reason)
SELECT 'backstage.com', website_url, name, 'identity_mismatch'
FROM venues WHERE website_url ILIKE '%backstage.com%' AND name ILIKE '%Chicago Actors Studio%'
ON CONFLICT DO NOTHING;

-- 3. Reject "Chris Thatcher" (person, not an organization)
UPDATE venues SET status = 'rejected'
WHERE name ILIKE '%Chris Thatcher%';

INSERT INTO discovery_rejections (school_name, reason)
SELECT name, 'not_an_organization'
FROM venues WHERE name ILIKE '%Chris Thatcher%'
ON CONFLICT DO NOTHING;

-- 4. Mark out-of-city schools and clean their sessions
UPDATE venues SET status = 'out_of_city'
WHERE name ILIKE '%All Out Comedy%' OR name ILIKE '%Third Coast%Comedy%';

DELETE FROM class_sessions WHERE school_id IN (
  SELECT s.id FROM schools s
  JOIN venues v ON s.venue_id = v.id
  WHERE v.name ILIKE '%All Out Comedy%' OR v.name ILIKE '%Third Coast%Comedy%'
);

-- 5. Reject "The Lab" entries with wrong-city coords (Ambler PA, etc.)
INSERT INTO discovery_rejections (url, school_name, reason)
SELECT website_url, name, 'out_of_city'
FROM venues
WHERE name ILIKE '%The Lab%'
  AND latitude IS NOT NULL
  AND (latitude < 41.5 OR latitude > 42.3 OR longitude > -87.0 OR longitude < -88.5);

UPDATE venues SET status = 'rejected'
WHERE name ILIKE '%The Lab%'
  AND latitude IS NOT NULL
  AND (latitude < 41.5 OR latitude > 42.3 OR longitude > -87.0 OR longitude < -88.5);

-- 6. Blocklist domains that have caused issues
INSERT INTO discovery_rejections (domain, reason) VALUES
  ('loopchicago.com', 'aggregator'),
  ('backstage.com', 'aggregator')
ON CONFLICT DO NOTHING;

-- 7. Mirror all status changes to schools table
UPDATE schools SET status = v.status
FROM venues v WHERE schools.venue_id = v.id AND schools.status != v.status;
