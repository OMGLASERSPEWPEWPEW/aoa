# ADR 0008: Class Discovery Pipeline Fix — Architecture Decisions

**Date:** 2026-08-18
**Status:** Accepted
**Feature:** Class Discovery Pipeline Fix
**PRD:** `.claude/docs/prd/class-discovery-pipeline-fix.md`
**Supersedes:** Portions of ADR-0006 Decision 2 (specifically the SerpAPI invocation placement)

---

## Context

The `class-discovery` Edge Function has been deployed since Phase 2 of the Art Classes Discovery feature (ADR-0006) but has never successfully discovered a new theater school. Thirteen schools exist in the database because they were manually seeded. The `venue_discovery_queue` is empty.

A four-model diagnosis identified three compounding root causes in the live source code:

1. **SerpAPI never executes.** The function uses a self-chaining architecture: each invocation processes one school, then fires an HTTP POST to itself for the next. `runSerpSearch()` is called only when `remaining === 0` — i.e., the final chain link. That final link is the target of a fire-and-forget call protected by an 8-second `AbortController` timeout from the preceding link. SerpAPI requires ~24 seconds (12 queries × 2 seconds each). The 8-second abort kills the chain before discovery runs.

2. **Aggregator domain poisoning.** When SerpAPI does run (in manual tests), Yelp, ClassPass, CourseHorse, Facebook, and Eventbrite URLs are treated as candidate school domains and added to the `existingDomains` dedup set. Any legitimate school that also has a Yelp listing appears after Yelp in the result set and is permanently suppressed.

3. **Queries too narrow and year-anchored.** Five queries, all with "2026" appended, 10 results each. The year suffix crowds out evergreen school pages. All five queries target the same three disciplines, producing 50 result slots dominated by Second City, iO, Annoyance, and aggregators.

This ADR documents two architectural decisions required to fix these root causes.

---

## Decision 1: Decouple SerpAPI Discovery from the School Scrape Chain (Option B Selected)

### Decision

SerpAPI discovery is promoted to a **first-class `action: "discover"` invocation path** that runs immediately when called, independent of school scraping. The existing `action: "start"` school scrape chain no longer calls `runSerpSearch()` at any point. Both actions live in the same `class-discovery` Edge Function — no new function is created.

### Alternatives Considered

**Option A: Keep SerpAPI at end of chain, fix the 8-second abort timeout**

Make the final chain link reliable by awaiting the next invocation properly instead of fire-and-forget. Increase the abort timeout from 8 seconds to 30 seconds, or remove the timeout entirely for the final link.

- Pro: Minimal code change. Two lines changed: the abort controller timeout value and the await pattern on the final self-POST.
- Pro: No change to the calling convention — the admin button and cron continue to call `action: "start"` and discovery follows automatically.
- Con: Discovery still depends on all schools finishing first. If any school in the chain times out or errors, the chain dies before reaching `remaining === 0`. Discovery is structurally coupled to the health of every school scrape in the batch.
- Con: The self-chaining architecture is inherently fragile for long-running sequential operations. Extending the abort timeout is a patch on a structural weakness, not a fix.
- Con: Supabase Edge Functions have a wall-clock time limit. A chain processing 13 schools sequentially before discovery can run approaches that limit under adverse network conditions.

**Option B: Run SerpAPI at job start before school scraping — add `action: "discover"` (selected)**

Add a distinct `action: "discover"` branch at the top of the request handler. When this action is received, `runSerpSearch()` is called immediately and its result returned. The `action: "start"` school scraping path is unchanged, except that the call to `runSerpSearch()` inside `processFirstSchool()` is removed.

- Pro: Discovery always executes regardless of scrape chain health. A timeout on school #7 does not prevent discovery.
- Pro: Discovery can be triggered independently — by a cron job, by an admin button press, or by a direct curl call. No schools need to be processed first.
- Pro: The school scrape chain becomes simpler. It processes schools; that is all it does. `runSerpSearch()` is not its responsibility.
- Pro: The `runSerpSearch()` function runs in its own top-level invocation with the full Edge Function time budget (60 seconds) available to it — not inside a fire-and-forget chain link with 8 seconds remaining.
- Con: Two separate actions must be triggered for a full run (discover + start). The admin UI or cron orchestration must call both. However, both can be called from the same admin session, and a cron job can be configured to fire both.

**Option C: Separate Edge Function for discovery**

Extract `runSerpSearch()`, `deduplicateAndQueue()`, and the aggregator blocklist into a new `school-discovery` Edge Function. `class-discovery` handles only school scraping.

- Pro: Total isolation. A crash in school scraping cannot affect the school discovery function.
- Con: Duplicates auth handling (JWT verification, CORS, scraper-key check) across two functions.
- Con: Duplicates the Supabase client setup and `discovery_logs` logging helper.
- Con: Another Edge Function to deploy, monitor, and keep in sync. The `class-discovery` function already handles both concerns cleanly — they need separate code paths, not separate functions.
- Con: The SerpAPI key and aggregator blocklist would need to be accessible in both functions, either via shared `_shared/` modules or duplicated constants.

### Rationale

Option B fixes the root cause (SerpAPI runs in a vulnerable position) without the fragility of Option A (patching a timeout) or the overhead of Option C (a new function). The `class-discovery` function already owns the discovery concern — the fix is to give discovery its own invocation path, not to move it elsewhere or to prop up the chain architecture.

The two-action calling convention (discover + start) is a minor inconvenience. The admin button can fire both sequentially. A future cron enhancement can do the same. The structural clarity — scraping is scraping, discovery is discovery — is worth the dual call.

### Consequences

- **Positive**: SerpAPI executes reliably on every `action: "discover"` call regardless of school scrape chain health.
- **Positive**: Discovery and scraping have independent failure domains. A broken school URL does not prevent discovery from running.
- **Positive**: The school scrape chain (`action: "start"`) is simpler — it processes schools and nothing else.
- **Negative**: A full discovery + scrape cycle requires two separate HTTP calls. Acceptable given admin-triggered and cron-triggered invocation patterns.
- **Neutral**: `runSerpSearch()` signature changes from `Promise<void>` to `Promise<{ queued, known, blocked, queries_run }>` to support the response body and observability surface.

---

## Decision 2: Aggregator Blocklist as Hardcoded Constant (Not a DB Table)

### Decision

The aggregator domain blocklist is a **hardcoded `Set<string>` constant** (`AGGREGATOR_DOMAINS`) at the top of `class-discovery/index.ts`. It is not stored in a database table, a Supabase secret, or a configuration file.

### Alternatives Considered

**Option A: DB table `aggregator_blocklist` with admin UI to add/remove domains**

A table with one `domain text UNIQUE NOT NULL` column. The Edge Function queries it on each discovery run and builds the Set dynamically.

- Pro: Admin can add new aggregator domains without redeploying the Edge Function.
- Pro: Domains are auditable via Supabase dashboard.
- Con: Every discovery run adds a DB query before processing results. Latency is small (~5ms) but the benefit does not justify it for a list that changes annually.
- Con: Adds a new table, RLS policies, admin UI surface, and migration for a list of ~15 domains. Complexity cost is disproportionate.
- Con: Mistakes in the admin UI (accidentally deleting a row) remove a blocklist entry silently. A hardcoded constant fails loudly if misconfigured.

**Option B: Supabase secret `AGGREGATOR_DOMAINS` as a comma-separated string**

The list is stored in Supabase secrets (`supabase secrets set AGGREGATOR_DOMAINS=...`) and parsed at runtime.

- Pro: Can be updated without redeploying.
- Con: Secrets are not designed for structured data. Parsing a comma-separated string is error-prone and adds startup complexity.
- Con: Supabase secrets are not version-controlled. A change to the blocklist is invisible in git history.
- Con: The blocklist is not sensitive data — it contains no keys, tokens, or credentials. Storing it in secrets conflates secret management with configuration.

**Option C: Hardcoded `Set<string>` constant in the Edge Function (selected)**

```typescript
const AGGREGATOR_DOMAINS = new Set([
  "yelp.com", "classpass.com", "coursehorse.com", "facebook.com",
  "eventbrite.com", "goldstar.com", "groupon.com", "timeout.com",
  "choosechicago.com", "dochub.com", "meetup.com", "thumbtack.com",
  "bark.com", "lessons.com", "takelessons.com",
]);
```

- Pro: Zero latency. The Set is built at module load time.
- Pro: Version-controlled. Every change to the list appears in git history with author and rationale.
- Pro: No DB query, no secret parsing, no admin UI surface needed for 15 domains.
- Con: Adding a new aggregator domain requires an Edge Function redeploy. Redeployment takes ~30 seconds and is a standard operation.

### Rationale

The aggregator domain list changes on an annual cadence, not a weekly or daily one. New aggregator platforms that achieve enough market penetration to contaminate search results appear infrequently. The current list of 15 domains will likely remain stable for 6–12 months. The maintenance overhead of a DB table (migration, RLS, admin UI, query) is not justified for a list this small and this stable.

The hardcoded constant is the simplest correct implementation. If the list grows past 50 entries, or if non-technical stakeholders need to manage it, migration to a DB table is straightforward: `INSERT INTO aggregator_blocklist SELECT unnest('{yelp.com,...}'::text[])`.

### Consequences

- **Positive**: Zero latency overhead per discovery run.
- **Positive**: Blocklist changes are version-controlled and reviewable in PRs.
- **Positive**: No additional DB schema, no admin UI, no migration needed for the blocklist itself.
- **Negative**: Adding a new aggregator domain requires redeploying the Edge Function. Accepted given the low change frequency.
- **Neutral**: The 15-entry initial list covers the major aggregators that appear in Google results for Chicago theater class queries. Additional entries can be added as they are observed in `discovery_logs` with `disposition: "blocked_aggregator"`.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-18 | Sashiko (code-architect) | Initial draft |
