# QA: Comprehensive Play Catalog

**Date:** 2026-08-14
**Scope:** `supabase/migrations/`, `supabase/functions/_shared/scraper/play-matcher.ts`, `supabase/functions/play-catalog-backfill/`
**Entry:** Discovery search + play detail pages
**PRD:** `.claude/docs/prd/play-catalog.md`
**Graph:** `docs/graphs/play-catalog.md`

---

## FR1 — Seed migration

- [ ] `SELECT count(*) FROM plays` returns 200+ after migration
- [ ] Searching "The Children's Hour" in Discovery returns a result
- [ ] Searching "God of Carnage" in Discovery returns a result
- [ ] Searching "Purpose" in Discovery returns a result
- [ ] Running the migration twice does not create duplicates (ON CONFLICT DO NOTHING)
- [ ] All 59 original plays still exist with unchanged data

---

## FR2 — Play-matcher runs after scraper

- [ ] After a scraper run completes for a venue, events created in that run have `play_id` set where a match exists
- [ ] Matcher runs even if only 1 event was created (no minimum batch)
- [ ] Matcher failure does not prevent the scraper from completing (non-blocking)

---

## FR3 — Exact title match

- [ ] Event titled "Hamlet" at Court Theatre → matched to play "Hamlet" (slug: hamlet)
- [ ] Event titled "hamlet" (lowercase) → still matches (case-insensitive)
- [ ] Event titled "The Glass Menagerie" → matches (leading article preserved in canonical title)
- [ ] Event titled "A Doll's House" with curly apostrophe → matches "A Doll's House" with straight apostrophe

---

## FR4 — Fuzzy match

- [ ] Event titled "August Osage County" (missing colon) → matches "August: Osage County" with confidence ≥ 0.8
- [ ] Event titled "Who's Afraid of Virginia Woolf" (missing ?) → matches
- [ ] Single-word titles ("Hamlet", "Fences") skip fuzzy and go to AI if exact fails
- [ ] Fuzzy match does NOT match "The Minutes" to "The Humans" (similar length, different words)

---

## FR5 — AI identification

- [ ] Event with unknown title + description mentioning "by Lillian Hellman" → AI returns playwright, creates play if not in catalog
- [ ] AI-created plays have `source = 'ai_matched'` (not 'curated')
- [ ] AI-created plays have `synopsis = null` (distinguishable from curated)
- [ ] AI prompt receives up to 10 events per call (batched)

---

## FR6 — Workshop/class/festival skip

- [ ] Event with `event_type = 'class'` → skipped, play_id stays null
- [ ] Event with `event_type = 'workshop'` → skipped
- [ ] Event with `event_type = 'festival'` → skipped
- [ ] Event with `event_type = 'open-call'` → skipped
- [ ] Event with `event_type = 'show'` → processed by matcher

---

## FR7 — Devised/original work protection

- [ ] "The Infinite Wrench" (Neo-Futurists) → NOT matched to any play, play_id stays null
- [ ] "Too Much Light Makes the Baby Go Blind" → NOT matched
- [ ] Event with "World Premiere" in title → NOT matched
- [ ] Improv show → NOT matched

---

## FR8 — Backfill

- [ ] POST to `/play-catalog-backfill` with `{ batch_size: 50, dry_run: true }` returns a summary without modifying data
- [ ] POST with `{ batch_size: 50 }` (no dry_run) sets play_id on matched events
- [ ] Re-running backfill is idempotent — already-matched events are skipped
- [ ] Backfill only processes events with `event_type = 'show'`

---

## FR9 — Re-scrape safety

- [ ] Re-scraping a venue does not clear play_id on existing events (scraper upsert row doesn't include play_id field)
- [ ] If a play is deleted from the catalog, events with that play_id have it set to null (FK ON DELETE SET NULL)

---

## FR10 — Source tracking

- [ ] Seed migration plays have `source = 'curated'`
- [ ] AI-created plays have `source = 'ai_matched'`
- [ ] `source` column has CHECK constraint limiting to ('curated', 'ai_matched', 'user_submitted')

---

## Regression Risks

- **Medium:** Scraper throughput — matcher adds processing time after each venue batch. Monitor scrape_logs duration_ms.
- **Medium:** Slug collision — AI might generate a slug that conflicts with an existing play. ON CONFLICT DO NOTHING handles this gracefully.
- **Low:** Play detail page — already handles null spectrum and empty production lists. No UI regression expected.
- **Low:** My Shows count — play_interest count query is independent of play catalog size.
