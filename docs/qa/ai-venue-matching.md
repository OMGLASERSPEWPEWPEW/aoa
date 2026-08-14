# QA: AI-Powered Venue Matching + Trainable Logs

**Date:** 2026-08-12
**Scope:** `supabase/functions/_shared/scraper/`, `supabase/functions/tic-crossref/`
**Entry:** Admin → Coverage → Run TIC Cross-Reference (or Run Scraper)

## TIC Pagination (FR-1)
- [ ] Coming Soon fetches all pages (~90 shows total, not just 17)
- [ ] Now Playing fetches all pages (~24 shows)
- [ ] Pagination includes 500ms delays between page fetches
- [ ] If a page fails to load, remaining pages still get processed

## Company-at-Venue Matching (FR-2)
- [ ] "Music Theater Works at North Shore Center" matches "North Shore Center for the Performing Arts"
- [ ] "Kokandy Productions at Chopin Theatre" matches "Chopin Theatre"
- [ ] "Hell In A Handbag Productions at The Clutch" matches "The Clutch" (if in DB)
- [ ] Direct venue names (no "at") still match normally

## AI Judgment (FR-3)
- [ ] Ambiguous pairs (score 0.3-0.6) are batched into one AI call
- [ ] AI correctly identifies "Drury Lane- Oakbrook" = "Drury Lane Theatre"
- [ ] AI correctly rejects false positives (e.g., "Edge Theatre" ≠ "The Edge Off-Broadway")
- [ ] If AI call fails, matching degrades gracefully to heuristic-only
- [ ] Only one AI call per bulk cross-reference run (not per venue)

## Trainable Match Logs (FR-4)
- [ ] Every match decision is logged to `match_decisions` table
- [ ] Log includes: our_venue_name, external_venue_name, heuristic_score, ai_verdict, final_decision
- [ ] Matched pairs show `final_decision = 'matched'` or `'ai_matched'`
- [ ] Rejected pairs show `final_decision = 'rejected'` or `'ai_rejected'`

## Known-Pair Cache (FR-5)
- [ ] Second run of TIC cross-reference skips AI for previously-decided pairs
- [ ] Known matched pairs auto-match without AI call
- [ ] Known rejected pairs auto-reject without AI call

## Data Quality
- [ ] Running TIC cross-reference fills 30+ NULL-date events (up from 7)
- [ ] Events enriched by TIC have `found_by` including `"tic"`
- [ ] No false-positive venue matches creating wrong event-venue links

## Regression
- **High:** Per-venue scraper still works — TIC matching is additive
- **Medium:** Existing heuristic matches (score >= 0.6) still work without AI
- **Low:** match_decisions logging doesn't slow down the matching pipeline
