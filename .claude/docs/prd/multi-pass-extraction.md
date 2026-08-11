# PRD: Multi-Pass AI Event Extraction Pipeline

**Date:** 2026-08-10
**Size:** Medium
**Status:** Draft

---

## 1. Problem

The event scraper uses a single DeepSeek prompt to extract ALL event fields from venue calendar HTML. This produces three data quality bugs:

1. **Prices default to free** — when DeepSeek can't find a price, it sets `price_min=0`. Leopoldstadt ($50+ tickets) shows as "Free."
2. **Venue misattribution** — events from other venues appear under the wrong venue. The Magic Parlour (at Palmer House hotel) shows under Goodman Theatre.
3. **Overly broad dates** — year-long programs (100 Free Acts of Theater: 2025-07-01 to 2026-08-31) always show as "tonight."

Root cause: one prompt tries to do too much. Extraction, verification, and enrichment are conflated. The model guesses when uncertain instead of returning null.

## 2. Solution

Two-pass AI pipeline per venue:

**Pass 1 (Extract):** Focused structural extraction from HTML. Returns ONLY fields visible in HTML: title, dates, event_type, prices, ticket_url, show_times. Explicit rules: "null if unknown, NOT 0." "Only events AT this venue."

**Pass 2 (Verify & Enrich):** For each extracted event, a lightweight verification call. Input is the small event JSON + venue name (NOT the full HTML). Checks: price plausibility, venue attribution, date range sanity. Adds: description, genre_tags, cast_members. Returns: corrected data + confidence score (0-1). Events that fail verification are rejected and not inserted.

Cost: ~$0.0013 per venue (up from $0.001). For 135 venues: ~$0.18 per scrape run.

Both prompts are visible in the Admin AI Prompts tab.

## 3. Functional Requirements

### FR-1: Pass 1 — Extraction Prompt

**Trigger:** `processVenue()` is called for a venue with a `calendar_url`.

**Behavior:** Sends cleaned HTML to DeepSeek V4 Flash with a focused extraction prompt. The prompt explicitly states:
- "If no price is listed, set price_min and price_max to **null** — NOT 0"
- "Only extract events PERFORMED AT this venue. Exclude events at other venues."
- "If a program runs year-round, use dates of the NEXT specific performance, not the entire season span"

Returns: `{ events: [{ title, event_type, start_date, end_date, price_min, price_max, ticket_url, show_times }] }`

Does NOT return: description, genre_tags, cast_members, photo_url (those come from Pass 2).

**Error state:** If DeepSeek returns non-200, log `ai_error`, skip Pass 2, return 0 events. If JSON parse fails, log `parse_error`.

**Data:** Logged to `ai_usage` with `feature = 'event-scraper-extract'`.

### FR-2: Pass 2 — Verification & Enrichment Prompt

**Trigger:** Pass 1 returns > 0 events.

**Behavior:** Sends the extracted event JSON (small — NOT the full HTML) to DeepSeek V4 Flash with a verification prompt. For each event, returns:
- `status`: "verified" | "corrected" | "rejected"
- `rejection_reason`: why the event was excluded (null if not rejected)
- `confidence`: 0.0-1.0 quality score
- `corrections`: any field corrections (e.g., price_min corrected from 0 to null)
- `description`: 1-2 sentence description
- `genre_tags`: from the standard genre list
- `cast_members`: if known, otherwise null

Events with `status = "rejected"` are NOT inserted into the events table. Events with `status = "corrected"` have their corrections applied before insertion.

**Error state:** If Pass 2 fails, fall back to Pass 1 data only (no descriptions/genres, confidence = 0.5). Log the error but don't fail the entire venue.

**Data:** Logged to `ai_usage` with `feature = 'event-scraper-verify'`.

### FR-3: Merge Pass 1 + Pass 2 Results

**Trigger:** Both passes complete.

**Behavior:** A `mergeExtractionResults()` function combines Pass 1 structural data with Pass 2 verifications:
- Match events by index (same order) or by title fallback
- Apply corrections from Pass 2 to Pass 1 fields
- Exclude rejected events
- Set confidence from Pass 2 (default 0.5 if Pass 2 is missing for an event)

The merged events are then inserted/updated in the events table, same as today.

**Data:** `extraction_confidence` column on events table stores the confidence score.

### FR-4: Fix "Free" Display for Unknown Prices

**Trigger:** An event has `price_min = null` and `price_max = null`.

**Behavior:** The `formatPrice()` function in the frontend currently shows "Free" for null prices. Change to show "$ TBD" when both are null. "Free" only shows when `price_min = 0`.

**Scope boundary:** Only changes the display logic. Does not affect the database.

### FR-5: Admin AI Prompts Tab — Show Both Passes

**Trigger:** Admin navigates to AI Prompts tab.

**Behavior:** Replace the single "Event Scraper" prompt card with two cards:
- **Pass 1: Extract** — shows the extraction prompt with `${venue_name}` placeholder
- **Pass 2: Verify & Enrich** — shows the verification prompt with `${venue_name}` and `${events_json}` placeholders

Both use the same card/expand UI pattern as existing prompts.

## 4. Architecture

### New file
- `supabase/functions/_shared/scraper/verification-prompt.ts` — Pass 2 prompt builder

### Modified files
| File | Change |
|------|--------|
| `supabase/functions/_shared/scraper/extraction-prompt.ts` | Rewrite prompt: remove description/genre/cast/photo fields, add explicit price/venue/date rules |
| `supabase/functions/_shared/scraper/types.ts` | Add Pass1Event, Pass2Verification, ExtractionResult, VerificationResult types |
| `supabase/functions/event-scraper/index.ts` | Split extractEvents into extractEventsPass1 + verifyEventsPass2, add mergeExtractionResults, update processVenue |
| `src/pages/Docs.tsx` | Replace single scraper prompt card with two cards |
| `src/lib/types.ts` | Add extraction_confidence to Event interface |
| `src/components/EventCard.tsx` or equivalent | Fix formatPrice: null → "$ TBD" not "Free" |

### Migration
- `supabase/migrations/20260810000003_extraction_confidence.sql` — Add `extraction_confidence float4` to events table

### No changes to
- `event-scrape-batch/index.ts` — calls `processVenue()` which handles both passes internally
- `html-cleaner.ts` — unchanged
- `logUsage.ts` — unchanged (used with different `feature` strings)
