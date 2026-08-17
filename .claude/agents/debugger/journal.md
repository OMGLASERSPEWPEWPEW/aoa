# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---


## Evolution Entry — 2026-08-14

### Context
Seven distinct bugs shipped to production during the 4-day scraper buildout. Every one traced back to a systematic pattern.

### Domain Insights
Edge functions are not the place for fire-and-forget. Deno Deploy and Supabase Edge Functions tear down the isolate the moment the response is sent. The 2026 consensus for background work: delegate to pg_cron or an external scheduler rather than having the function call itself inline.

### Rules Encoded
1. **Await everything in edge functions.** No exceptions. If you cannot await it, move it to a queue.
2. **Secret mismatches are invisible.** When a secret-gated path fails silently, echo the secret length and prefix in the response as first diagnostic.
3. **Filters must be exhaustive.** Every query that drives a processing loop must include a termination condition in the WHERE clause.
4. **Scope survives the block.** `const` inside a `for` block is not accessible outside it. Declare result variables at function scope before the loop.

### Pattern Recognition
- **Silent failures are the most expensive bugs.** pg_net silently failed. ticShowsToEnrichments silently dropped shows. The gap query silently re-processed the same venue 160 times. In every case, the absence of an error message was the error.
- **Test assumptions about third-party APIs.** `?viewall=1` was assumed to work. It didn't. TIC lookup was assumed to search both pages. It didn't. Always curl-verify.

### Commitments
1. Write a runbook for edge-function self-invocation covering the four failure modes
2. Propose migrating the scraper chain trigger to pg_cron to eliminate self-call fragility
3. Add logging to every "filter" or "drop" operation — if data is excluded, log why

### Questions for Tomorrow
- Can we add a "silent drop detector" that alerts when a function processes N items but produces 0 output?
- Should self-chain failures automatically create a scrape_jobs error entry instead of silently stopping?


## Evolution Entry — 2026-08-16

### Context

Today's session surfaced a class of bug I am calling "join poisoning" — where adding a seemingly harmless join to a Supabase query silently turns a successful result set into an empty one. The map markers disappeared not because any code threw an error, but because `play:plays(*)` was added to a query used by the map, and when that join encountered data conditions it could not satisfy, Supabase returned zero rows instead of raising an error. The `(data ?? [])` fallback happily accepted the empty array. No error. No log. Just a blank map.

This is the same meta-pattern from August 14 — silent failures are the most expensive bugs — but with a new mechanism. Last time it was unawaited promises and missing WHERE clauses. This time it is the query shape itself quietly changing semantics.

### Domain Research — Silent Query Failures

The distinction between "null data" and "error swallowing" is crucial and often collapsed. They are two different failure modes:

**Null data (legitimate empty):** The query succeeded but matched zero rows. The application correctly shows nothing. This is a feature, not a bug — unless the developer expected results and the emptiness masks a deeper issue.

**Error swallowing (suppressed failure):** The query encountered an error (bad join, RLS denial, type mismatch), but the client code treated the error branch as empty data. Supabase's PostgREST layer returns `{ data: null, error: {...} }` on failure, but patterns like `(data ?? [])` without checking `error` convert this into a silent empty result.

The fix pattern emerging in this codebase is three-fold: (1) Always destructure `error` alongside `data`. (2) Log the error with a bracketed tag like `[queries]` so it is grep-searchable. (3) Still return `[]` (graceful degradation), but make the failure visible. This matches what Google's SRE handbook calls "fail loud, degrade gracefully" — the user sees an empty state rather than a crash, but the developer sees a console error.

The deeper lesson: every query function should be auditable in two seconds. If you read the function signature and see `Promise<T[]>`, you should be able to glance at the body and confirm "yes, errors are logged, not swallowed." The commit at 4f45bbc retroactively added error logging to three query functions that were missing it. The right answer is to never write a query function without it.

### World Context

The broader industry is converging on this problem. OpenTelemetry's 2026 traces now include "semantic emptiness" signals — spans that return valid-shaped but empty data — as a first-class anomaly. Datadog's August release added "zero-result query" alerts that distinguish between "intentionally empty" and "suspiciously empty" based on historical cardinality. The idea that a successful HTTP 200 with zero rows can be a bug is gaining mainstream tooling support.

### Curiosity — Debugging in Aviation

Aviation's "dark cockpit" philosophy is the inverse of our problem. In a dark cockpit, everything off means everything is fine — lights only illuminate on failure. Software defaults to the opposite: silence means fine, noise means failure. But silent query failures break this contract. The aviation equivalent would be an engine instrument that reads "0 RPM" both when the engine is off (expected) and when the sensor wire is severed (catastrophic). Aviation solved this with "disagree lights" — sensors that cross-check each other. If RPM reads 0 but fuel flow reads positive, the disagreement itself triggers an alert. We could apply this: if the map has venues but zero events, that is a "disagree" state that should log a warning.

### Rules Encoded

1. **Every Supabase query function must destructure `error` and log it.** The `(data ?? [])` pattern alone is error swallowing.
2. **Join changes are breaking changes.** Adding a join to a shared query can silently alter its result set. Create a new function (like `fetchEventsForMap`) rather than modifying a shared one.
3. **NDJSON parse failures must be caught per-line, not per-stream.** The ScrapeContext correctly uses try/catch inside the line loop (line 379), but the catch body is empty. At minimum, log the malformed line for post-mortem.
4. **Cross-check "disagree" states.** If venues > 0 but events === 0, log a warning. If a streaming response returns 200 but zero parsed messages, log a warning.

### Commitments

1. Audit all query functions in `src/lib/queries.ts` for the error-swallowing pattern — any that destructure only `data` without checking `error` need fixing
2. Add a "disagree detector" to `fetchMapData` — if venues > 0 and events === 0, console.warn
3. Propose replacing the empty `catch {}` in NDJSON parsing (ScrapeContext line 379) with `catch (e) { console.warn('[class-discovery] malformed NDJSON line:', line, e) }`

### Questions for Next Session

- Should we create a `safeQuery` wrapper that enforces error logging at the type level, making it impossible to ignore the error field?
- Can we add a dev-mode assertion that fires when a query returns empty but the same query returned non-empty in the last 5 minutes (staleness disagree)?
