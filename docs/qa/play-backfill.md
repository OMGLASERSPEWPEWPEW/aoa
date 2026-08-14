# QA: Play Catalog Backfill

**Date:** 2026-08-14
**Scope:** `supabase/functions/play-catalog-backfill/`, `src/pages/Docs.tsx`
**Entry:** Admin dashboard → Coverage tab
**PRD:** `.claude/docs/prd/play-backfill.md`

## Backfill button

- [ ] Coverage tab shows "N UNLINKED EVENTS" count on load
- [ ] "Run Play Backfill" button is visible below the Run Scraper button
- [ ] Tapping the button shows "MATCHING..." disabled state while running
- [ ] On completion, results display inline: exact, fuzzy, AI matches, plays created, unmatched
- [ ] Running backfill again shows updated (lower) unlinked count
- [ ] If all events are linked, button shows "0 UNLINKED EVENTS" and backfill returns immediately

## Edge Function

- [ ] POST to `/functions/v1/play-catalog-backfill` with `{ batch_size: 50 }` returns PlayMatchSummary JSON
- [ ] Events with `event_type = 'class'` are not processed (skipped)
- [ ] Events already linked (`play_id IS NOT NULL`) are not re-processed
- [ ] `batch_size` is capped at 200
- [ ] Running twice is idempotent — second run processes fewer events

## Regression

- **Low:** Scraper pipeline unaffected — backfill uses same `runPlayMatcherBatch` as the scraper hook
- **Low:** No schema changes — reads/writes to existing tables only
