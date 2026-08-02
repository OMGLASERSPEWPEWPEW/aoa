# Fix Broken Venue URLs

**Category:** data-issue
**Status:** complete
**Phase:** 7
**Priority:** P2

## User's Original Request
> I can get to shattered globe here: https://www.sgtheatre.org/ so why can't you? If we can't get a website we shouldn't list it.

## Diagnosis

The v0.4.18 enrichment scan identified 4 broken venue URLs:
- **Shattered Globe:** `shatteredglobe.org` is dead — real domain is `sgtheatre.org`
- **A Red Orchid:** `www.aredorchidtheatre.org` 301 redirects to `aredorchidtheatre.org` (no www) — scraper follows redirects but URL should be canonical
- **Redtwist Theatre:** DNS resolution failure — domain is dead, no alternative found
- **Court Theatre:** 403 (bot-blocking, but site is live) — keep URL, no change needed

The frontend already hides the WEBSITE button when `website_url` is null, so nulling dead URLs is the correct fix.

## Graph

```
┌─────────────────────────────────────────────────────────┐
│ FIX VENUE URLS — DATA FIX GRAPH                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [verify-urls]                                          │
│    │  curl each broken URL, confirm which are dead      │
│    │  vs temporarily down vs wrong domain               │
│    ▼                                                    │
│  [write-migration]                                      │
│    │  SQL UPDATE for fixable URLs                       │
│    │  SQL SET NULL for dead URLs                        │
│    ▼                                                    │
│  [push-migration]                                       │
│    │  supabase db push                                  │
│    ▼                                                    │
│  [verify-frontend]                                      │
│    │  Confirm WEBSITE button hidden for nulled URLs     │
│    │  Confirm WEBSITE button works for fixed URLs       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## AI Loops (AL)

### Loop: verify-urls
- **Trigger:** Enrichment scan reported 4 URL failures
- **Inner cycle:**
  1. Discover: curl each URL with follow-redirects to see final status
  2. Assess: Categorize as fixable (wrong URL), dead (DNS/permanent), or transient (403/502)
  3. Decide: Fix URL, null URL, or keep URL
- **Evaluator:** Each URL has a clear disposition with evidence
- **Stop condition:** All 4 URLs triaged

### Loop: write-migration
- **Trigger:** verify-urls complete
- **Inner cycle:**
  1. Plan: One migration with UPDATE statements per venue
  2. Execute: Write SQL using slug-based WHERE clauses
  3. Verify: Migration applies cleanly via `supabase db push`
- **Evaluator:** No SQL errors, affected row counts match expectations
- **Stop condition:** Migration applied to remote database

## Commit
- **Hash:** d843cbf
- **Message:** v0.4.19: Map UX overhaul — green borders for tonight, remove banner, add date/time
- **Version:** 0.4.19

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| 2026-08-01 | user | request | Shattered Globe URL wrong, broken URLs shouldn't be listed |
| 2026-08-01 | ai | explore | curl'd all 4 broken URLs: Shattered Globe → sgtheatre.org, Red Orchid → drop www, Redtwist → DNS dead, Court → 403 (keep) |
| 2026-08-02 | ai | implement | Created migration 20260802000001_fix_venue_urls.sql |
| 2026-08-02 | ai | verify | supabase db push applied cleanly |
| 2026-08-02 | ai | commit | d843cbf — v0.4.19 |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| verify-urls | — | — | — |
| write-migration | — | — | — |
| push-migration | — | — | — |
| verify-frontend | — | — | — |
| **Total** | — | — | — |
