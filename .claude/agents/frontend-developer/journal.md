# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---


## Evolution Entry — 2026-08-14

### Context
Venue sheet rebuilt with swipe-to-dismiss (3 iterations), scraper dashboard with field pills and expandable events, map preloading, ribbon layout fix.

### Domain Insights
CSS `scroll-snap` bottom sheets are production-viable for multi-stop scenarios in 2026, eliminating JS from the core motion. The 2026 consensus is Pointer Events + `touch-action` CSS over Touch Events + `preventDefault()`. Pointer Events unify mouse/touch/pen, while `touch-action: none` on drag handles prevents the browser from claiming the gesture.

### Pattern Recognition
- **Swipe dismiss took 3 iterations**: touchEnd-only → velocity-only → visual drag tracking. The missing piece was visual feedback during the drag — users need to see the sheet following their finger.
- **Refs for transient state**: Dorsaidh's mind-meld insight confirmed — use refs (not useState) for drag positions and animation state. useState triggers re-renders at 60fps which causes jank.
- **Preloading**: Dynamic `import('mapbox-gl')` on AppShell mount + `<link rel="preconnect">` in HTML head. Module is cached before user taps Map.

### Commitments
1. Add `touch-action: none` on the drag handle area
2. Extract a reusable `useSwipeDismiss` hook from VenueSheet
3. Adopt Pointer Events over Touch Events going forward
4. Consider CSS scroll-snap for the full venue sheet rebuild

### Questions for Tomorrow
- Should the venue sheet use CSS scroll-snap with defined snap points (peek/half/full) instead of JS-driven drag?
- Can we preload map tiles (not just the JS) for the user's Chicago center coordinates?

---

## Evolution Entry — 2026-08-16

### Context
Heavy session: built the ClassDiscoveryDashboard (amber-themed full-screen overlay), extended ScrapeContext with NDJSON streaming for class discovery, added dual-mode map (shows/classes) with per-discipline color-coded markers, and created ClassSheet, MapModeControl, and MapModeFilters components. Also fixed dark mode overlay tokens and button wrapping on the Coverage tab.

### Domain: NDJSON Streaming into React Context State

The `runClassDiscovery` function in ScrapeContext implements a clean pattern for streaming NDJSON into context state. The approach uses the Web Streams API directly: `response.body.getReader()` + `TextDecoder` with `{ stream: true }` to handle multi-byte characters at chunk boundaries. A line buffer accumulates partial lines and splits on `\n`, processing complete lines while keeping the remainder for the next chunk.

**What works well:** Accumulating totals in local `let` variables (schoolsScraped, eventsFound, etc.) and only calling `setClassDiscovery` with the aggregated snapshot per message avoids the stale-closure problem that plagues naive streaming-into-state patterns. If you read from `prev` inside every setState, you create a dependency chain where each update must wait for React's reconciliation. The local-variable approach is essentially a manual reducer outside React's render cycle.

**What could be better:** The current implementation lacks AbortController integration — if the user navigates away mid-stream, the reader keeps consuming. The pattern should wire `reader.cancel()` into either a cleanup return from the useCallback (not possible since it's not a useEffect) or expose an abort method on the context. The `fetch-event-source` library from Microsoft solves this for SSE, but NDJSON needs the raw reader approach since SSE has its own framing protocol. A potential extract: a `useNDJSONStream<T>(url, handlers)` hook that manages the reader lifecycle, abort, and error recovery.

### World: Tech Headlines (2026-08-16)

Stripe acquiring OpenRouter for $7B+ signals that AI routing/gateway infrastructure is now a first-class financial category — relevant because our own ai-gateway Edge Function follows the same multi-provider routing pattern. Firefox shipping a native iOS adblocker is notable for PWA testing since our users on iOS Safari may behave differently from Firefox users. The "Models Are Getting Dumber on Purpose" headline tracks with our model registry approach in `models.ts` — intentionally routing cheaper/faster models to lower-stakes features.

### Curiosity: Per-Domain Color Theming in Design Systems

Today's work introduced a clear pattern: shows use `var(--accent)` (the app's burgundy/wine), while classes use `oklch(.80 .16 110)` (warm amber/gold). The ClassDiscoveryDashboard doubles down with dedicated amber constants (`#D4A017`, `#8a6a10`, `#1a1005`). The `DISCIPLINE_COLORS` map goes further — six distinct oklch values keyed to improv, acting, writing, musical, devised, and youth.

This mirrors how mature design systems like IBM Carbon use "contextual color tokens" — a base palette that shifts meaning by domain. Shopify Polaris does something similar with their "tone" system (success, warning, critical, highlight). The key insight: oklch is the right color space for this because you can maintain perceptual lightness across hues, so an improv marker at `oklch(.80 .16 110)` and a writing marker at `oklch(.68 .13 235)` both feel "balanced" on the map even though they are different chroma and hue values. The alternative (hex or HSL) makes it hard to achieve equal visual weight across the palette.

One risk: inline style objects with hardcoded oklch values scattered across ClassMarker.ts, MapModeControl.tsx, MapModeFilters.tsx, and ClassSheet.tsx. If the palette shifts, that is a shotgun change. A `classTheme` token map (similar to `DISCIPLINE_COLORS` but broader, covering bg/border/text/glow) would centralize this.

### Commitments
1. Extract a `useNDJSONStream` hook from runClassDiscovery with AbortController support
2. Centralize the class/discipline color tokens into a single theme map imported everywhere
3. Add abort/cancel capability to the class discovery streaming (expose on context)
4. Consider oklch-based token generation for future domain themes (belt colors, social features)

### Questions for Tomorrow
- Should the discipline color map live in a shared theme file rather than ClassMarker.ts?
- Can the NDJSON streaming pattern be generalized for future pipelines (venue enrichment, mentor streaming)?
- Is there a threshold where we should switch from inline styles with theme constants to CSS custom properties scoped by data attributes?
