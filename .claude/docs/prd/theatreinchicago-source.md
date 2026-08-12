# PRD: TheatreInChicago.com Aggregator Source

**Date:** 2026-08-12
**Status:** Draft
**Priority:** P0
**Dependencies:** Intelligent Event Scraper v2 (strategy-agent.ts)

## Executive Summary

theatreinchicago.com is a comprehensive Chicago theater aggregator with ~114 listed shows (24 now playing + 90 coming soon), including exact run dates, performance schedules, ticket URLs, cast, and reviews — all on individual detail pages at `/show-slug/ID/`. It also has venue pages at `/theatre/venue-slug/ID/` that list all shows at a venue with dates.

Our scraper currently has 60% NULL dates because many venue websites don't list dates on their calendar pages. theatreinchicago.com has those dates. This feature integrates it as a **cross-reference and fallback source** in the v2 strategy tree, filling missing fields on events we've already discovered.

## User Stories

1. As an **admin**, I want the scraper to check theatreinchicago.com when a venue's own website doesn't have dates, so events get dates without manual data entry.
2. As a **user**, I want to see accurate show dates and times on the map, so I can plan my week around actual performances — not placeholder data.

## Functional Requirements

### FR-1: TheatreInChicago Venue Lookup

**Trigger:** During `executeStrategyTree`, after initial extraction + link following, if events still have `start_date = NULL`.

**Behavior:**
1. Construct a search URL: `https://www.theatreinchicago.com/theatre/{venue-slug}/{venue-tic-id}/` — but we don't have the TIC venue ID. Instead, search by venue name.
2. Fetch `https://www.theatreinchicago.com/search.php` with the venue name as a search parameter (POST form or URL query — needs discovery during implementation).
3. Parse the search results for show listings matching the venue name.
4. For each matched show, extract the detail page URL (`/show-slug/ID/`).
5. Return the list of show URLs + any dates visible on the search result page itself.

**Error state:** If the search returns no results or the fetch fails, log as `"aggregator_no_match"` and continue. Do not stop the pipeline.

**Data:** No database writes. Returns a list of candidate show URLs.

**Scope:** This step costs 1 HTTP fetch (no AI call). Only triggered when events are still incomplete after link following.

### FR-2: TheatreInChicago Detail Page Parser

**Trigger:** FR-1 found matching shows with detail page URLs.

**Behavior:** For each detail page URL (up to 3, subject to budget):
1. Fetch the detail page HTML
2. Parse **without AI** using regex/DOM patterns (the data is structured):
   - Run dates: "Through {date}" or "{start_date} - {end_date}"
   - Performance schedule: day/time pairs (e.g., "Wed, Aug 12: 1:00pm & 7:00pm")
   - Ticket URL: link with "Tickets" text
   - Price: if listed (often not on TIC)
   - Cast: listed in detail section
   - Genre: visible as show type
3. Convert parsed data into `TargetedEnrichment[]` format
4. Match to existing events by fuzzy title comparison
5. Merge using `mergeTargetedExtraction` — fill NULLs only, never overwrite

**Error state:** If a detail page fetch fails, skip it and continue. If parsing fails (unexpected HTML structure), skip with a warning.

**Data:** Returns `TargetedEnrichment[]` for merging into existing events.

**Scope:** No AI calls needed — TIC detail pages are structured enough to parse with regex. Each page costs only 1 HTTP fetch (~2 seconds). This is essentially free compared to a DeepSeek call.

### FR-3: Strategy Tree Integration

**Trigger:** After link following (Step 3) and before verification (Step 4) in `executeStrategyTree`.

**Behavior:** Insert a new step between link following and verification:

```
Step 3: Link following (existing)
    ↓
Step 3.5: Aggregator cross-reference (NEW)
    - Check: any events still missing start_date?
    - If yes and budget allows fetch: query TIC for this venue
    - Parse results, merge into events
    - Re-evaluate completeness
    ↓
Step 4: Verification (existing)
```

Add `"aggregator_crossref"` to the `StrategyStep.step` union type. Log the step in the strategy trace with URL, events affected, and fields filled.

**Error state:** Aggregator step failure is never fatal. Catch all errors, log, continue to verification.

**Data:** Updates in-memory events via `mergeTargetedExtraction`. Logged in `strategy_trace`.

**Scope:** Adds at most 1-4 HTTP fetches (1 search + up to 3 detail pages) and 0 AI calls per venue.

### FR-4: Venue Name Matching

**Trigger:** When searching TIC for a venue.

**Behavior:** Our venue names may differ from TIC's names. Matching strategy:

1. **Exact match**: "Steppenwolf Theatre" → "Steppenwolf Theatre"
2. **Normalized match**: lowercase, strip "theatre/theater", strip "company", strip "chicago" → compare
3. **Substring match**: our "Court Theatre" matches TIC's "Court Theatre - University of Chicago"
4. **Fuzzy match**: if normalized names share >60% of words, consider a match

When multiple TIC venues match, take the one with the highest word overlap.

**Error state:** If no match found, log `"aggregator_no_match"` and skip.

**Data:** No persistence needed — matching is in-memory per scrape run.

**Scope:** Pure function, no side effects.

### FR-5: TIC as Bulk Cross-Reference (Periodic)

**Trigger:** Separate from per-venue scraping. Run as a standalone operation from admin UI (new button) or as part of discovery.

**Behavior:**
1. Fetch all pages of `/nowplayingrs.php` and `/comingsoonrs.php` (2 + 6 = ~8 pages)
2. Parse all show listings: title, venue name, dates (coming soon page has dates on the listing)
3. For each show, match to an existing event in our database by title + venue name fuzzy match
4. For matched events missing `start_date`, update with TIC's dates
5. Report: X events enriched, Y events unmatched, Z new shows not in our DB

This is a periodic bulk operation, not part of the per-venue strategy tree. It catches shows that our venue-specific scraper missed entirely.

**Error state:** If fetching a page fails, skip it and continue with the others. Report how many pages were successfully processed.

**Data:** Direct database updates to `events.start_date`, `events.end_date`, `events.source_url` (set to TIC URL). Set `events.extraction_status` to `'complete'` for enriched events.

**Scope:** ~8 HTTP fetches, 0 AI calls. Could enrich dozens of events in seconds.

### FR-6: Register TIC as a Data Source

**Trigger:** Migration, run once.

**Behavior:** Insert a row into `venue_sources`:
```sql
INSERT INTO public.venue_sources (id, name, source_type, base_url, scrape_frequency, reliability_score)
VALUES (gen_random_uuid(), 'Theatre in Chicago', 'listing_site', 'https://www.theatreinchicago.com', 'weekly', 0.90);
```

**Data:** One new row in `venue_sources`.

**Scope:** Migration only.

## Non-Functional Requirements

- **No AI cost**: TIC pages are structured enough to parse with regex. Zero DeepSeek calls.
- **Rate limiting**: Add 500ms delay between TIC fetches to be polite. Max 5 fetches per venue.
- **Caching**: If we fetch a TIC venue page for venue A, cache the HTML for 24 hours in case venue B also needs it.
- **User-Agent**: Use the same bot identifier as our existing scraper.

## Technical Considerations

### TIC URL Patterns
| Page | URL | Data |
|------|-----|------|
| Now Playing | `/nowplayingrs.php` | 24 shows, no dates on listing |
| Now Playing (all) | `/nowplayingrs.php?viewall=1` | All shows, no dates |
| Coming Soon | `/comingsoonrs.php` | 90 shows, WITH dates on listing |
| Coming Soon (all) | `/comingsoonrs.php?viewall=1` | All shows with dates |
| Show Detail | `/show-slug/ID/` | Full data: dates, times, cast, tickets |
| Venue Page | `/theatre/venue-slug/ID/` | Shows at venue with dates |
| Search | `/search.php` | Filter by venue, type, area, date |

### Detail Page Data Format (from analysis)
```
Run dates: "Through August 16, 2026" or "Aug 13 - Nov 8, 2026"
Schedule: "Wed, Aug 12: 1:00pm & 7:00pm"
Ticket link: href to ticketmaster/external with "Tickets" anchor text
Cast: "Nolan White (Ponyboy Curtis)" format
Genre: "Musical", "Drama", etc.
```

### New Files
| File | Purpose |
|------|---------|
| `_shared/scraper/tic-parser.ts` | Parse TIC listing and detail pages (regex, no AI) |
| `_shared/scraper/tic-lookup.ts` | Search TIC for a venue, return matched show URLs |
| `_shared/scraper/venue-name-matcher.ts` | Fuzzy venue name matching |

### Modified Files
| File | Change |
|------|--------|
| `_shared/scraper/strategy-agent.ts` | Add Step 3.5 aggregator cross-reference |
| `_shared/scraper/types.ts` | Add `"aggregator_crossref"` to StrategyStep |
| Migration | Register TIC in venue_sources |

## Success Metrics

- Events with NULL `start_date` drops from 60% to under 10% (TIC covers most active Chicago shows)
- Per-venue scrape cost stays flat (TIC adds 0 AI calls)
- TIC bulk cross-reference fills dates for 50+ events in a single run

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| TIC changes HTML structure | Parser uses loose regex patterns; detail pages are stable (slug/ID URL pattern) |
| TIC blocks our bot | Polite scraping: 500ms delays, proper User-Agent, max 5 fetches per venue |
| Venue name mismatch | Multi-strategy matching (exact, normalized, substring, fuzzy) |
| TIC data conflicts with venue data | Never overwrite non-NULL fields; TIC data fills gaps only |
| TIC has stale/wrong dates | TIC is maintained by a human editorial team; reliability is high. Cross-validate with venue website data when both exist |
