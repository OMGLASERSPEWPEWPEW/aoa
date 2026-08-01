# Truncated Scraper Responses

**Category:** data-issue
**Status:** pending
**Phase:** 1
**Priority:** P1

## User's Original Request
> Steppenwolf, Goodman, Annoyance, and Writers Theatre hit 8192 max tokens with 0 events extracted. Their pages are too large and the JSON gets cut off mid-response.

## Diagnosis
The scraper sends up to 30,000 chars of cleaned HTML (~7,500 input tokens) to DeepSeek Flash with `max_tokens: 8192`. But max_tokens controls OUTPUT tokens, not total. The real issue: these large venue pages produce JSON responses that exceed 8,192 output tokens before the closing `]}` — the JSON is truncated and `JSON.parse()` fails silently, returning 0 events.

Steppenwolf, Goodman, Annoyance, and Writers Theatre all showed `ai_output_tokens: 8192` with `events_found: 0` in the scraper results.

**Root cause:** Output token budget (8192) is insufficient for venues with many events. A venue with 10+ shows needs ~12,000+ output tokens for the full JSON response.

**Files involved:**
- `supabase/functions/event-scraper/index.ts` line 72 — increase max_tokens
- `supabase/functions/_shared/scraper/html-cleaner.ts` — optionally reduce maxChars
- `supabase/functions/_shared/scraper/extraction-prompt.ts` — optionally add "be concise" instruction

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Increase `max_tokens` from 8192 to 16384 in event-scraper/index.ts
  2. Add JSON repair: if `JSON.parse()` fails, attempt to close the truncated JSON array
  3. Optionally reduce `maxChars` from 30000 to 20000 to lower input token count
  4. Add retry logic: if output hits max_tokens and 0 events found, retry with smaller HTML chunk
- **Files:** supabase/functions/event-scraper/index.ts, supabase/functions/_shared/scraper/html-cleaner.ts
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** unit test for JSON repair function, e2e scraper test with large HTML input
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** deploy scraper → trigger scrape → verify Steppenwolf/Goodman/Annoyance/Writers return events
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | 4 venues hit max tokens with 0 events |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
