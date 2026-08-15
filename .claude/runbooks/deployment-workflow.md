# Deployment Workflow — Operational Runbook

## Version & Changelog

### Rule: Always use /cap for commits — never manual git add/commit/push

**Wrong**: `git add . && git commit -m "..." && git push` — skips version bump, changelog, and atomic grouping.
**Right**: Invoke `/cap` which handles version bump, changelog entry, commit convention, and push gate.
**Why**: Multiple commits shipped without version tracking. User had to remind about `/cap`. See memory: `feedback-use-cap.md`.

### Rule: After deploying Edge Function changes, reset `scraped_at` for affected venues

**Wrong**: Deploy new scraper code → user presses "Run Scraper" → gets "0 of 0 venues" because all venues were scraped within 24 hours by the OLD code.
**Right**: Run a migration to `SET scraped_at = NULL WHERE ...` for venues that should be re-scraped with the new code.
**Why**: The batch query's 24-hour cooldown prevents re-scraping. New code doesn't help until the cooldown expires.

## Testing Edge Functions

### Rule: Test Edge Functions via curl before telling the user to test in the app

**Wrong**: "Hit Run Scraper" → user gets 500 error → debugging in production.
**Right**: `curl -X POST .../functions/v1/event-scrape-batch -H "x-scraper-key: ..." -d '{"action":"start"}'` first.
**Why**: Faster feedback loop. The user shouldn't be the first person to hit new code.

### Rule: Check for variable scope bugs when referencing loop variables outside the loop

**Wrong**: `const result` inside `for` loop → referenced outside in job update code → `result is not defined`.
**Right**: Save to a `let lastResult` declared outside the loop.
**Why**: `const` in a `for` block is block-scoped. Even with BATCH_SIZE=1, it's a bug that will crash at runtime.
