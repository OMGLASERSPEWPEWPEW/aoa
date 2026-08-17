# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---


## 2026-08-16 — NDJSON Streaming Endpoints & Server-Side API Key Management

### Context

The class-discovery Edge Function was added alongside a refactor of the shared scraper modules. Both class-discovery and event-scraper now stream NDJSON over long-lived HTTP connections. ScrapeContext on the client consumes these streams via `ReadableStream.getReader()`. A new `SERPAPI_KEY` secret was introduced for web search in class-discovery.

### Findings

**1. NDJSON Streaming — No Timeout/Abort on Client (Medium)**
The `ScrapeContext.tsx` NDJSON reader loop (`while (true) { const { done, value } = await reader.read() ... }`) has no client-side timeout or abort controller. If the server stalls mid-stream (Edge Function hits Deno resource limits, network partition), the client hangs indefinitely. The server side has per-fetch timeouts (15s for HTML, 30s for DeepSeek), but the overall stream has no max duration. Recommendation: add an `AbortController` with a total timeout (e.g., 10 minutes) on the client fetch, and handle `AbortError` gracefully in the UI.

**2. Authorization Model — Any Authenticated User Can Trigger Scrapers (Medium)**
Both `event-scraper` and `class-discovery` accept any valid JWT _or_ the `SCRAPER_SECRET` header. There is no admin role check. The `scrape_jobs` RLS policy confirms: `auth.role() = 'authenticated'` is the only gate for INSERT. This means any registered user can trigger expensive AI scraping runs (DeepSeek calls, SerpAPI calls). While the `CostBudget` class limits per-run spend, there is no rate limiting on how frequently a user can invoke these endpoints. A malicious or curious user could repeatedly trigger runs, exhausting API budgets. Recommendation: add an `is_admin` check on the profiles table or use Supabase `app_metadata` to restrict scraper invocation to admin users. At minimum, add per-user rate limiting (e.g., one scraper run per hour per user).

**3. CORS Default Fallback Behavior (Low)**
In both `class-discovery` and `event-scraper`, when the `Origin` header is not in `ALLOWED_ORIGINS`, the CORS response defaults to `ALLOWED_ORIGINS[0]` (`http://localhost:5204`) rather than omitting `Access-Control-Allow-Origin` entirely. This is not exploitable because browsers enforce CORS strictly — a mismatched origin still blocks the response. However, it is semantically incorrect and could confuse security auditors. Recommendation: return no `Access-Control-Allow-Origin` header when the origin is not in the allowlist.

**4. SERPAPI_KEY Management (Good)**
The `SERPAPI_KEY` is correctly managed: stored in Supabase secrets (`Deno.env.get`), never exposed to the client, graceful degradation when unset (logs warning, skips search phase, still returns 200). The API key is passed as a query parameter to SerpAPI — this is SerpAPI's documented pattern, not a vulnerability, since the call is server-to-server over HTTPS.

**5. Service Role Key in Shared Modules (Informational)**
Both `process-venue.ts` and `strategy-agent.ts` read `SUPABASE_SERVICE_ROLE_KEY` from the environment at module scope. This is the correct pattern for Edge Functions. The service role key bypasses RLS, which is necessary for scraper writes to `events`, `scrape_logs`, and `venue_discovery_queue`. No client-side exposure was found — the frontend exclusively uses the anon key.

**6. dangerouslySetInnerHTML in EmotionWheel (Low)**
`EmotionWheel.tsx` line 92 uses `dangerouslySetInnerHTML` with `e.label.replace(' ', '<br/>')`. The labels come from a hardcoded constant (`EMOTIONS` from `lib/emotions.ts`), not user input. No XSS risk exists here, but the pattern should be flagged to prevent future copy-paste into user-content contexts. A safer alternative: split on space and render with a `<br />` React element.

**7. Missing Security Headers on Vercel (Medium)**
The `vercel.json` configures caching headers but omits all standard security headers: no `Content-Security-Policy`, no `X-Content-Type-Options`, no `X-Frame-Options`, no `Strict-Transport-Security`, no `Referrer-Policy`. While Vercel applies some defaults, explicit headers are defense-in-depth. Recommendation: add a catch-all header block in `vercel.json` with at minimum `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.

### Commitments

- Track the scraper authorization gap as the highest-priority item for next sprint.
- Draft a `vercel.json` security headers block for review.
- Propose an `AbortController` pattern for NDJSON stream consumption in ScrapeContext.
