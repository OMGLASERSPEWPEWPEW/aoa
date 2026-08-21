# Supabase Edge Functions — Operational Runbook

## Self-Chaining (function calls itself)

### Rule: Use `await fetch()` with abort timeout, not fire-and-forget

**Wrong**: `fetch(selfUrl, ...).catch(...)` without `await` — Deno kills the request after the response is sent.
**Right**: `await fetch()` with an `AbortController` timeout (8s). The next invocation starts independently on the server.
**Why**: Deno Edge Functions terminate the isolate after the response. Unawaited promises get cancelled.

### Rule: Deploy with `--no-verify-jwt` when the function handles its own auth

**Wrong**: Relying on the Supabase API gateway to validate JWTs for server-to-server calls.
**Right**: `supabase functions deploy <name> --no-verify-jwt` + validate `x-scraper-key` or user JWT inside the function.
**Why**: The gateway rejects non-JWT bearer tokens. Self-chain calls use `SCRAPER_SECRET`, not a JWT.

### Rule: Include `Authorization: Bearer <ANON_KEY>` in self-chain headers

**Wrong**: Only sending `x-scraper-key` — gateway may strip non-standard headers.
**Right**: Send both `Authorization: Bearer ${SUPABASE_ANON_KEY}` (for gateway) and `x-scraper-key: ${SCRAPER_SECRET}` (for function auth).
**Why**: Even with `--no-verify-jwt`, some gateway configurations still expect an Authorization header.

## Secrets

### Rule: Test deployed secrets by returning debug info, not by trusting `supabase secrets list`

**Wrong**: Assuming `supabase secrets list` shows the actual deployed env var value.
**Right**: Add temporary debug output to the response: `{ _debug: { keyStart: SECRET?.slice(0,8), keyLen: SECRET?.length } }`. Deploy, test, remove debug.
**Why**: `supabase secrets set` may have been called with a different value than what's currently deployed. The only source of truth is the running function.

## RLS for Observability Tables

### Rule: Check RLS before blaming MCP auth

**Wrong**: MCP can't read a table → assume OAuth is broken → ask user to re-authenticate.
**Right**: Check if the table has `anon SELECT` policy. MCP uses the anon role. No anon policy = no access, period.
**Why**: Wasted two OAuth attempts when the real fix was a one-line RLS policy. The MCP auth was fine — the table just didn't allow anon reads.

### Rule: Every log table gets anon SELECT at creation time

**Wrong**: Create `discovery_logs` with only `authenticated SELECT` policy.
**Right**: Always include `CREATE POLICY "anon_read_<table>" ON <table> FOR SELECT TO anon USING (true);` for any table Claude needs to query.
**Why**: Log tables contain operational data, not user PII. Claude reads them via MCP (anon role) or REST API (anon key). No anon policy = Claude is blind.

## Scrape Job Queue

### Rule: Gap-priority queries MUST include a `scraped_at` recency filter

**Wrong**: `WHERE venue_id IN (venues with NULL-date events)` — no time filter.
**Right**: Add `.or("scraped_at.is.null,scraped_at.lt." + 24hAgo)` to gap queries.
**Why**: Without it, a venue with genuinely-missing dates gets re-scraped every 30 seconds forever (160 iterations of the same venue).

### Rule: Always clear stuck jobs before testing new scraper code

**Wrong**: Deploy fix → user presses "Run Scraper" → gets 409 because old stuck job is still "running".
**Right**: After deploying scraper changes, run a migration or direct query to mark stuck jobs as failed before testing.
