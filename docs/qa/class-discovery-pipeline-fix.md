# QA: Class Discovery Pipeline Fix

**Date:** 2026-08-18
**Scope:** `supabase/functions/class-discovery/`, `src/pages/Docs.tsx`, `src/components/admin/`
**Entry:** Admin Coverage tab → "Discover Schools" button
**PRD:** `.claude/docs/prd/class-discovery-pipeline-fix.md`
**Graph:** `docs/graphs/class-discovery-pipeline.md`

---

## FR-1: Decoupled Discovery Action

- [ ] Pressing "Discover Schools" in the Coverage tab triggers a POST to `class-discovery` with `{"action": "discover"}`
- [ ] The response contains `queued`, `known`, `blocked`, and `queries_run` counts
- [ ] Discovery runs independently of whether a class scrape job is in progress
- [ ] The school scrape chain (`action: "start"`) still completes and marks the job as `completed` without calling `runSerpSearch`
- [ ] Both "Run Scraper" (shows) and "Discover Schools" (classes) can run simultaneously without blocking each other
- [ ] If `SERPAPI_KEY` is not set, the response includes `warning: "SERPAPI_KEY not set"` and HTTP 200 (not 500)
- [ ] Calling `action: "discover"` twice in rapid succession does not create duplicate queue entries (domain dedup prevents it)

## FR-2: Aggregator Domain Blocklist

- [ ] SerpAPI results from yelp.com are not inserted into `venue_discovery_queue`
- [ ] SerpAPI results from classpass.com, coursehorse.com, facebook.com, eventbrite.com are blocked
- [ ] Subdomain matching works: `chicago.yelp.com` is blocked, not just `yelp.com`
- [ ] Blocked results appear in `discovery_logs` with `disposition = 'blocked_aggregator'`
- [ ] A legitimate school site (e.g., `greenshirtstudio.com`) is NOT blocked even if it also has a Yelp listing

## FR-3: Expanded Search Queries

- [ ] The function fires 12 queries (not 5)
- [ ] No query contains "2026" or any year string
- [ ] Each query requests 20 results (`num: "20"`)
- [ ] Queries cover: improv, long-form improv, Meisner, scene study, on-camera, audition, voiceover, sketch/comedy writing, musical theater, movement, conservatory, continuing education
- [ ] The 500ms inter-query delay is preserved

## FR-4: Discovery Observability

- [ ] After a discovery run, `discovery_logs` contains one row per SerpAPI result
- [ ] Each row has `run_id`, `query`, `raw_url`, `domain`, and `disposition`
- [ ] The `disposition` column only contains valid enum values: `queued`, `blocked_aggregator`, `already_known_venue`, `already_in_queue`, `insert_error`
- [ ] The admin Coverage tab shows a summary card with queued/blocked/known counts from the most recent discovery run
- [ ] A `logDiscoveryResult` failure does not crash the discovery pipeline (best-effort logging)

## FR-5: iO Theater Duplicate Fix

- [ ] Only one iO venue exists in the `venues` table after the migration
- [ ] The surviving venue is `io-chicago` with `calendar_url = 'https://www.ioimprov.com/chicago/classes/'`
- [ ] The `io-theater` slug no longer appears in query results on the map or admin pages
- [ ] If `io-theater` had class_sessions, they were re-parented to `io-chicago` (not deleted)

## FR-6: Queue Promotion Flow

- [ ] The Coverage tab shows a "School Discovery Queue" section with a count badge
- [ ] Each pending school shows: name, domain, snippet, Promote button, Reject button
- [ ] Clicking "Promote" creates a row in `venues` (venue_type='school') and a row in `schools`
- [ ] The promoted venue has Chicago centroid coords (41.8781, -87.6298) as placeholders
- [ ] After promotion, the queue entry is marked `promoted = true` and disappears from the list
- [ ] Clicking "Reject" marks the entry with a `rejected_at` timestamp and it disappears from the list
- [ ] A rejected school does not reappear in future discovery queue views
- [ ] If the venue slug already exists (slug conflict on promote), an inline error is shown — no crash
- [ ] Promoted schools appear as class markers on the map after the next class scrape run

## Regression Risks

- **High:** Existing `action: "start"` school scraping must still work after removing `runSerpSearch` from the chain terminal. Verify by running a class scrape and confirming all schools are processed and the job reaches `completed` status.
- **Medium:** The `venue_discovery_queue` insert in `deduplicateAndQueue` must handle the new logging calls without slowing down. Verify discovery runs complete within 60 seconds (the Edge Function timeout).
- **Low:** The admin Coverage tab layout may shift with the new "School Discovery Queue" section. Verify on mobile (375px) that buttons don't overlap or overflow.

## End-to-End Verification

- [ ] Run `action: "discover"` via curl with the scraper key
- [ ] Verify `discovery_logs` has rows with mixed dispositions (some queued, some blocked, some known)
- [ ] Verify `venue_discovery_queue` has new rows with `raw_category = 'school'`
- [ ] Open the admin Coverage tab and see the pending schools
- [ ] Promote one school and verify it appears in `venues` and `schools` tables
- [ ] Run `action: "start"` and verify the newly promoted school is scraped
