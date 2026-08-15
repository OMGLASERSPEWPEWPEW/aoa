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
