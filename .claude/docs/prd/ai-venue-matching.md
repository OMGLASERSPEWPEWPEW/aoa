# PRD: AI-Powered Venue Matching + Trainable Match Logs

**Date:** 2026-08-12
**Status:** Draft
**Priority:** P0

## Executive Summary

The TIC cross-reference matched only 7 of 197 NULL-date events because of three compounding failures: (1) `?viewall=1` doesn't work on TIC — we only parsed 17 of 90 Coming Soon shows, (2) the "Company at Venue" format reduces word overlap scores below threshold, (3) no AI fallback for ambiguous matches. Fix: fetch all TIC pages, add AI judgment for ambiguous pairs, strip "Company at" prefixes, and log every match decision for future training.

## Functional Requirements

### FR-1: Fix TIC Pagination

**Trigger:** When fetching TIC Coming Soon or Now Playing listing pages.

**Behavior:** TIC uses `pageNum_rsComingSoon=N&totalRows_rsComingSoon=90` for pagination, NOT `viewall=1`. The scraper must:
1. Fetch page 0 (default — no param needed)
2. Parse the pagination to find `totalRows_rsComingSoon` value
3. Calculate number of pages: `Math.ceil(totalRows / 16)`
4. Fetch all remaining pages with 500ms delays between fetches
5. Parse shows from all pages and concatenate results

Same pattern for Now Playing: `pageNum_rsNowPlaying=N&totalRows_rsNowPlaying=X`.

**Error state:** If a page fetch fails, skip it and continue with others.

**Data:** Returns full `TicShow[]` (~90 Coming Soon + ~24 Now Playing = ~114 shows total).

**Scope:** Modify `tic-lookup.ts` `getComingSoon()` and `getNowPlaying()` functions.

### FR-2: Strip "Company at Venue" Format

**Trigger:** When matching TIC venue names against our database.

**Behavior:** TIC listing venue names often include the producing company: "Music Theater Works at North Shore Center for the Performing Arts". The matcher should:
1. First try matching the full TIC name (current behavior)
2. If score < 0.6, check if name contains " at " — split and try matching just the venue part (after " at ")
3. If venue-only part matches, use that score

**Error state:** N/A — pure logic enhancement.

**Data:** No schema changes. Modifies `venue-name-matcher.ts`.

**Scope:** ~5 lines of code in `matchVenueName`.

### FR-3: AI Judgment for Ambiguous Venue Matches

**Trigger:** When heuristic matching scores between 0.3 and 0.6 (the "maybe" zone — too low for auto-match, too high to ignore).

**Behavior:**
1. Collect all ambiguous venue pairs across the batch (not per-venue — batch them)
2. Send one DeepSeek Flash call with all pairs: "For each pair, are these the same venue? Reply JSON: [{pair_index, same: true/false, confidence: 0-1}]"
3. For pairs where AI says `same: true` with confidence > 0.7, treat as a match
4. Log the AI verdict to `match_decisions` table

**Prompt:**
```
You are matching Chicago theater venue names. For each pair, determine if they refer to the same physical venue. Consider that venues may have different names for the same location (e.g., "Drury Lane Theatre" and "Drury Lane- Oakbrook" are the same).

Pairs:
1. "Our DB: X" vs "TIC: Y"
2. ...

Return JSON: { "verdicts": [{ "pair": 1, "same": true, "confidence": 0.95 }] }
```

**Error state:** If AI call fails, treat all ambiguous pairs as non-matches (same as current behavior).

**Data:** One AI call per scrape run (not per venue). Cost: ~$0.001.

**Scope:** New function in `venue-name-matcher.ts`, called from `tic-lookup.ts` or `tic-crossref/index.ts`.

### FR-4: Match Decisions Table (Trainable Logs)

**Trigger:** Every venue matching decision — match, reject, or AI judgment.

**Behavior:** Log to `match_decisions` table:
```sql
CREATE TABLE public.match_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  our_venue_name text NOT NULL,
  our_venue_id uuid REFERENCES venues(id),
  external_venue_name text NOT NULL,
  source text NOT NULL,             -- 'tic', 'chicagoplays', etc.
  heuristic_score numeric(4,3),
  ai_verdict boolean,               -- null if heuristic-only
  ai_confidence numeric(3,2),       -- null if heuristic-only
  final_decision text NOT NULL CHECK (final_decision IN ('matched', 'rejected', 'ai_matched', 'ai_rejected')),
  human_override boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_match_decisions_pair ON match_decisions(our_venue_name, external_venue_name, source);
```

Over time this table becomes:
- A **known-pair lookup** — if we've seen "Drury Lane Theatre" ↔ "Drury Lane- Oakbrook" before, skip the AI call and use the cached decision
- **Training data** — export to fine-tune a matching model
- **Admin audit** — humans can flag `human_override = true` to correct bad matches

**Error state:** Logging failures don't block matching — best-effort insert.

**Data:** New table + index.

**Scope:** Migration + insert calls in matching functions.

### FR-5: Known-Pair Cache

**Trigger:** Before heuristic matching, check if this exact pair has been decided before.

**Behavior:**
1. Query `match_decisions` for `(our_venue_name, external_venue_name, source)`
2. If a previous decision exists: use it (skip heuristic + AI)
3. If no previous decision: run heuristic → AI (if ambiguous) → log decision

**Error state:** If cache query fails, fall through to heuristic matching.

**Data:** Reads from `match_decisions` table.

**Scope:** Small addition to matching flow.

## Technical Considerations

### TIC Pagination Parameters
```
Coming Soon: /comingsoonrs.php?pageNum_rsComingSoon=N&totalRows_rsComingSoon=90
Now Playing: /nowplayingrs.php?pageNum_rsNowPlaying=N&totalRows_rsNowPlaying=X
```
Pages are 0-indexed. ~16 shows per page.

### Files to Modify

| File | Change |
|------|--------|
| `_shared/scraper/tic-lookup.ts` | Fix pagination — fetch all pages |
| `_shared/scraper/venue-name-matcher.ts` | Add "Company at Venue" split, AI judgment function |
| `_shared/scraper/tic-parser.ts` | Extract totalRows from pagination HTML |
| `tic-crossref/index.ts` | Use improved matching |
| Migration | Create match_decisions table |

## Success Metrics

- TIC shows parsed: 90+ (up from 17)
- Events matched with TIC dates: 30+ (up from 7)
- NULL start_date rate: under 50% (down from 69%)
- Every match decision logged for future training
