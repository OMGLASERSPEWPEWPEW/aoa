# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---


## Evolution Entry — 2026-08-14

### Context
27-commit scraper buildout: self-chaining Edge Functions, TIC aggregator integration, AI venue matching, play catalog, and multiple production bugs.

### Domain Insights
The pg_net-to-direct-fetch pivot for Edge Function self-chaining is now the canonical pattern. Supabase Edge Functions tear down isolates after response — fire-and-forget is dead on arrival. Our strategy tree architecture independently mirrors the graph-based pipeline pattern that tools like ScrapeGraph AI have converged on in 2026.

### Pattern Recognition
- **Self-chain pattern**: `await fetch(selfUrl)` with AbortController timeout + `--no-verify-jwt` deploy. Document as ADR.
- **Env var drift**: `supabase secrets set` and deployed env vars can diverge. Always verify with debug output, never trust `secrets list`.
- **Circuit breakers**: Every self-chaining function needs max_depth, wall-clock deadline, and no-progress detection.

### Commitments
1. Typed `_shared/env.ts` accessor module for all Edge Function secrets
2. Circuit breakers on all self-chaining functions (max iterations, wall-clock, no-progress)
3. `deno check` in pre-deploy workflow
4. ADR documenting the self-chaining pattern and its failure modes

### Questions for Tomorrow
- Should the scraper self-chain migrate to pg_cron triggers instead of HTTP self-calls?
- Can we add a health-check endpoint that verifies secret availability without exposing values?
