# QA: Art Classes Discovery

**Date:** 2026-08-15
**Scope:** `supabase/migrations/20260815000010-13_*.sql`, `supabase/functions/event-scraper/`, `supabase/functions/class-discovery/`, `src/components/MapMarker.tsx`, `src/components/MapView.tsx`, `src/components/VenueSheet.tsx`, `src/components/MapFilterChips.tsx`, `src/components/MapKey.tsx`, `src/components/ScraperDashboard.tsx`
**PRD:** `.claude/docs/prd/art-classes-discovery.md`
**Entry:** Open the app on map view at http://localhost:5204/app/map

---

## FR-1: Class Schema Fields

- [ ] Running `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'events' AND column_name IN ('instructor_name', 'skill_level', 'session_count', 'class_format') ORDER BY column_name` returns exactly 4 rows, all with `is_nullable = 'YES'`
- [ ] `SELECT skill_level FROM events WHERE skill_level NOT IN ('beginner','intermediate','advanced','all-levels','drop-in')` returns 0 rows (CHECK constraint enforced)
- [ ] `SELECT class_format FROM events WHERE class_format NOT IN ('ongoing','workshop','intensive','drop-in','series')` returns 0 rows (CHECK constraint enforced)
- [ ] `SELECT instructor_name, skill_level, session_count, class_format FROM events WHERE event_type = 'show' LIMIT 10` — all 4 columns are NULL for show events (backcompat confirmed)
- [ ] TypeScript: `src/lib/types.ts` `Event` interface includes all 4 new fields as optional/nullable with correct union types

---

## FR-2: School Venue Seeds

- [ ] `SELECT COUNT(*) FROM venues WHERE venue_type = 'school'` returns 8
- [ ] `SELECT name, calendar_url FROM venues WHERE venue_type = 'school' ORDER BY name` — all 8 rows have non-null `calendar_url` values
- [ ] Fetching each `calendar_url` returns HTTP 200 (spot-check at least Second City, iO Chicago, Annoyance)
- [ ] `SELECT slug FROM venues WHERE venue_type = 'school' ORDER BY slug` — no duplicate slugs
- [ ] Running the seed migration a second time produces 0 errors and does not duplicate any rows (ON CONFLICT DO NOTHING confirmed)
- [ ] Each school venue has a valid `latitude` and `longitude` — `SELECT name, latitude, longitude FROM venues WHERE venue_type = 'school' AND (latitude IS NULL OR longitude IS NULL)` returns 0 rows

---

## FR-3: Class Field Extraction in Scraper

- [ ] `buildExtractionPrompt("iO Chicago")` — confirm the returned string contains the text "instructor_name", "skill_level", "session_count", "class_format"
- [ ] `buildExtractionPrompt("iO Chicago")` — confirm the string instructs that for show events, class keys should be omitted (not set to null)
- [ ] `buildVerificationPrompt("iO Chicago", [{title:"Improv 101", event_type:"class"}])` — returned string contains "instructor_name" and "class_format"
- [ ] Run `event-scraper` against iO Chicago. After scrape: `SELECT title, event_type, instructor_name, skill_level, class_format FROM events WHERE venue_id = (SELECT id FROM venues WHERE slug = 'io-chicago')` — at least one row with `event_type = 'class'` and non-null `skill_level`
- [ ] Run `event-scraper` against a non-school venue (e.g., Steppenwolf performing venue). Confirm no spurious `instructor_name` values appear on show events
- [ ] A class event with `skill_level = 'beginner_advanced'` (not in enum) is NOT inserted — CHECK constraint rejects it and the scraper logs an insert error, does not crash the batch

---

## FR-4: Class Discovery Edge Function

- [ ] `curl -sX POST $SUPABASE_URL/functions/v1/class-discovery -H "x-scraper-key: $SCRAPER_SECRET"` returns HTTP 200
- [ ] The response body is valid NDJSON — each line is a parseable JSON object
- [ ] The stream contains at least one line matching `{"type":"school_scrape",...}`
- [ ] The stream ends with exactly one `{"type":"summary",...}` line
- [ ] Summary object has keys: `run_id`, `schools_scraped`, `schools_events_found`, `search_queries_run`, `new_venues_queued`, `ai_input_tokens`, `ai_output_tokens`, `serpapi_calls`
- [ ] `curl -sX POST $SUPABASE_URL/functions/v1/class-discovery` (no auth header) returns HTTP 401
- [ ] With SERPAPI_KEY secret unset: function still returns 200, processes school venues, `search_queries_run` = 0, response contains `warning` field in summary
- [ ] With SERPAPI_KEY set: function runs search queries, `search_queries_run` > 0 and ≤ 5, `serpapi_calls` ≤ 5
- [ ] New schools discovered via web search appear in `venue_discovery_queue` with `raw_category = 'school'` and `promoted = false`
- [ ] Re-running class-discovery does not create duplicate rows in `venue_discovery_queue` (upsert ON CONFLICT guard confirmed)
- [ ] Scrape logs for class-discovery run appear in `scrape_logs` table with correct `venue_id` and `venue_name` values

---

## FR-5: Class Map Markers

<!-- qa:human Requires map with VITE_MAPBOX_TOKEN set -->
- [ ] On the map, 8 amber diamond markers are visible for the 8 seeded school venues
- [ ] Each amber diamond marker is visibly larger than a standard show marker — side by side, the size difference is noticeable
- [ ] The amber diamond glyph is `◇` (open diamond) not `◆` (filled diamond) or the venue's normal venue_type glyph
- [ ] The amber color (`#D4A017`) is distinct from the tonight indicator green (`var(--live)`) in both light and dark themes
- [ ] Clicking an amber diamond marker selects it — the marker scales up and shows an amber glow shadow
- [ ] Clicking elsewhere on the map deselects the marker — it returns to normal size with no glow
- [ ] A venue with `venue_type = 'school'` but NO class events in the current time window renders as a normal gray marker (or is hidden if time filter requires events)
- [ ] A venue with `venue_type = 'storefront'` that happens to have a class event in DB renders as a standard storefront marker (square, not diamond) — `hasClassEvents` is true but the square chip style is overridden only when... wait, re-check this: `hasClassEvents` should check venue_type = 'school' OR event_type, per PRD. Confirm class markers show for school venues only OR for any venue with class events (PRD says "venue with `venue_type = 'school'` AND at least one class event")
- [ ] In dark theme, amber marker background `#1a1005` is visually distinct from the dark map background
- [ ] In light theme, amber marker background `#1a1005` provides sufficient contrast against the lighter map tiles

---

## FR-6: Class Detail in VenueSheet

<!-- qa:human Requires tapping markers on mobile/simulator -->
- [ ] Tapping an amber diamond marker for iO Chicago opens the VenueSheet
- [ ] The VenueSheet shows an amber-bordered section labeled "CLASSES AT THIS VENUE"
- [ ] The classes section appears ABOVE the WEBSITE / directions buttons and BELOW the PWYC/usher row
- [ ] Each class entry shows the class title in italic serif font
- [ ] If `instructor_name` is non-null, it appears as "INSTRUCTOR: [NAME]" in monospace uppercase
- [ ] If `instructor_name` is null, the instructor line does not render (no empty "INSTRUCTOR:" label)
- [ ] Skill level chip renders in amber-tinted styling (amber border, amber text) with the value uppercased (e.g., "BEGINNER")
- [ ] Class format chip renders in neutral styling (gray border) with the value uppercased (e.g., "SERIES")
- [ ] If `session_count` is 8, "8 SESSIONS" appears in the chip row
- [ ] If `price_min` is set, price appears as "$325" or "$325–$349" in the chip row
- [ ] If `start_date` and `end_date` are set, dates appear as "Sep 15 – Nov 3"
- [ ] ENROLL link appears in amber for classes with a valid `ticket_url`
- [ ] Tapping ENROLL opens the enrollment URL in a new browser tab
- [ ] A `ticket_url` that does not start with "http" does NOT show the ENROLL link
- [ ] Tapping a storefront theater marker (non-school) opens VenueSheet with NO classes section
- [ ] VenueSheet still shows the upcoming shows section normally when the class section is also present
- [ ] VenueSheet is scrollable when both class and show sections are present (no content cut off at `75dvh` without scroll)

---

## FR-7: Class Filter on Map and Discover

- [ ] The map filter chip row includes a "CLASSES" chip
- [ ] "CLASSES" chip shows a count (number of venues with class events in the current time window)
- [ ] Tapping "CLASSES" chip when inactive: all venues WITHOUT class events are dimmed to 22% opacity
- [ ] School venues WITH class events remain at full opacity when CLASSES chip is active
- [ ] Tapping "CLASSES" chip again (toggle off): all venue markers return to normal opacity
- [ ] Combining CLASSES + TONIGHT chips: only school venues with both class events AND tonight events are undimmed (intersection logic)
- [ ] On the Discover page (`/app/discover`), the event type filter includes "class" and "workshop" chips that correctly filter the search results

---

## FR-8: Admin Tools

- [ ] Admin panel Coverage tab shows a "DISCOVER CLASSES" button
- [ ] "DISCOVER CLASSES" button is distinct from the existing "RUN SCRAPER" button (different label, same style)
- [ ] Pressing "DISCOVER CLASSES" triggers a POST to `class-discovery` Edge Function — network tab confirms the request
- [ ] Live NDJSON stream output appears in the log panel as the discovery runs (same real-time streaming as the existing scraper)
- [ ] "DISCOVER CLASSES" button is disabled while the discovery run is in progress
- [ ] After the run completes, the button re-enables
- [ ] Admin Coverage tab shows a "CLASS COVERAGE" row with 4 stat boxes: SCHOOLS, CLASSES, W/ INSTRUCTOR, W/ LEVEL
- [ ] The SCHOOLS count matches `SELECT COUNT(*) FROM venues WHERE venue_type = 'school'`
- [ ] The CLASSES count matches `SELECT COUNT(*) FROM events WHERE event_type IN ('class','workshop') AND (end_date IS NULL OR end_date >= CURRENT_DATE)`
- [ ] W/ INSTRUCTOR and W/ LEVEL counts are ≤ CLASSES count

---

## Edge Cases

- [ ] School venue with `calendar_url` that returns a 404: scraper logs `fetch_error` for that venue, other venues in the batch continue processing
- [ ] School venue with a JavaScript-rendered calendar page (returns empty body): scraper logs `events_found: 0`, no crash
- [ ] Class event with `session_count = 0` is rejected — 0 is not a meaningful session count. Confirm schema allows 0 but the extraction prompt discourages it.
- [ ] Class event with `skill_level = null` and `class_format = null`: renders in VenueSheet with no chips — just title, dates, price, ENROLL. No empty chip placeholders.
- [ ] Two school venues at the same coordinates (theoretical): both amber diamonds render — Mapbox stacks them. No crash.
- [ ] School venue added via `class-discovery` to `venue_discovery_queue` but not yet promoted: it does NOT appear as an amber diamond on the map (queue-first pattern preserved)
- [ ] User with no location permission: map still renders at Chicago center, class markers still visible
- [ ] Time filter set to "Today" with no class events today: class markers may be hidden (if no events in today window). CLASSES filter chip shows "CLASSES 0". This is correct behavior.

---

## Regression Risks

- **High: `event-scraper` changes** — The extraction prompt and write logic changes touch the entire event scraping pipeline. Any syntax error in `process-venue.ts` or `extraction-prompt.ts` would break ALL event scraping, not just class scraping. Regression test: trigger a full event-scraper run after changes and confirm a known show (e.g., Steppenwolf performing venue) still produces show events with correct fields.
- **Medium: `MapMarker.tsx` changes** — The class marker override block must come after the relationship-coloring logic. If it's inserted before, show markers could unintentionally receive class styling. Regression test: confirm a non-school venue with a `want_to_see` watchlist status still shows dashed accent border (not amber solid border).
- **Medium: `VenueSheet.tsx` changes** — Adding `classEvents` useMemo must not affect `upcomingEvents` computation. Regression test: tap a non-school venue with upcoming shows — confirm shows still appear in the "COMING UP" section.
- **Low: `MapFilterChips.tsx` changes** — Adding CLASSES chip to the `FILTERS` array. If the array is typed as a readonly tuple, TypeScript may error. Regression test: `npm run build` completes clean.
- **Low: `src/lib/types.ts` changes** — Adding nullable fields to `Event` interface. All consumers of `Event` must handle the new fields being optional/null. No existing code should break since these are additive nullable fields.
