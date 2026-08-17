# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---


## 2026-08-16 — DOM Marker Scaling, Context Bloat, and Bundle Pressure

### Context

The map now renders two independent marker layers — venue markers (shows) and class markers (schools) — both using Mapbox GL's DOM-element marker API (`new mapboxgl.Marker({ element: el })`). Each marker is a hand-built DOM tree: venue markers create 3 elements (container, chip, tail) and class markers create 3-4 elements (container, ring, label, optional date badge). The ScrapeContext has grown to manage three separate state objects (discovery, scraper, classDiscovery) with ~20 fields total. Bundle size sits at 2,642 KB raw / 732 KB gzipped — well above the 200 KB gzip target, with Mapbox GL as the dominant contributor.

### DOM Marker Performance at Scale

Mapbox GL's DOM marker approach (`mapboxgl.Marker` with custom HTML elements) is fundamentally different from its WebGL symbol/circle layers. Each DOM marker lives in a separate div overlaid on the canvas, meaning the browser must composite, layout, and paint every marker independently. The critical thresholds from real-world benchmarks:

- **< 100 markers**: No measurable impact. Current venue count (40-80 Chicago theaters) is safe.
- **100-300 markers**: Noticeable scroll/zoom jank on mid-range mobile. Pan events trigger layout recalc on every marker div. This is where the app lands if both layers are fully visible simultaneously (80 venues + 30 schools = 110+ DOM elements with 300+ child nodes).
- **500+ markers**: Frame drops below 30fps on most mobile devices. `will-change: transform` on each marker div forces GPU layer promotion — 500 layers is catastrophic for mobile GPU memory.

The current ghost-mode implementation is clever (reducing opacity and disabling pointer-events) but does NOT remove markers from the DOM. Both layers render ALL markers at ALL times, just styled differently. At current scale (~110 combined markers) this is borderline acceptable on iPhone, but will degrade as more schools and venues are added.

**Recommended threshold**: If venue + school count exceeds 150, switch the background layer to `map.addSource` + `map.addLayer` (WebGL-rendered circles/symbols). Only the foreground layer should use DOM markers. This gives the visual richness of custom HTML for the active mode while keeping the ghost layer at zero DOM cost.

### Marker Teardown/Rebuild Churn

Both marker effects (`useEffect` for venues at line 138, for classes at line 182) destroy ALL markers and rebuild them from scratch on every dependency change. The venue marker effect has 9 dependencies including `selectedVenue` — meaning clicking a marker triggers a full teardown and rebuild of every venue marker on the map. Each rebuild creates ~240 DOM elements (80 venues x 3 elements each), removes the old 240, and triggers a full layout recalc. The separate `useEffect` at line 226 that handles selected-state styling is actually redundant with this rebuild.

**Fix**: Separate marker creation from marker styling. Create markers once when the data changes; update classes/styles in-place when selection, filters, or mode change. The `venueMarkersRef` map already stores element references — use them for in-place updates instead of full rebuilds.

### ScrapeContext Size and Re-render Blast Radius

ScrapeContext wraps the entire app tree (`App.tsx` nesting: ThemeProvider > QueryClientProvider > AuthProvider > ScrapeProvider`). It holds three state objects plus two boolean states plus three async callbacks. Every `setClassDiscovery` call during streaming (line 348, inside a tight read loop) triggers a re-render of every component that calls `useScrape()`. During a class discovery run, this fires every time a school result arrives — potentially dozens of times in rapid succession.

React does batch state updates within the same synchronous block, but the streaming reader calls `setClassDiscovery` inside an async `while(true)` loop, meaning each iteration is a separate microtask and therefore a separate render. At 30 schools this is 30+ renders propagated through every consumer.

**Fix options**: (1) Split ScrapeContext into three contexts (DiscoveryContext, ScraperContext, ClassDiscoveryContext) so streaming updates only re-render ClassDiscoveryDashboard consumers. (2) Use `useReducer` with batched dispatch. (3) Throttle `setClassDiscovery` to at most once per 500ms during streaming, accumulating intermediate updates.

### Bundle Size

The 732 KB gzip figure is 3.6x the 200 KB target. Mapbox GL alone is ~450 KB gzipped. The dynamic import in AppShell.tsx is being defeated because MapView.tsx statically imports mapbox-gl (the build warning confirms this). Fixing the static import in MapView to use a lazy-loaded wrapper would split Mapbox GL into a separate chunk loaded only when the map tab is active, cutting initial load by ~60%.

### Action Items

1. **Short-term** (no refactor): Remove `selectedVenue` and `selectedSchool` from marker-creation effect dependencies; handle selection styling via the existing ref-based `useEffect` pattern.
2. **Medium-term**: Split ScrapeContext into per-concern contexts; throttle streaming state updates.
3. **Medium-term**: Fix the Mapbox GL code-splitting by removing the static import and using `React.lazy` + dynamic import for the MapView component itself.
4. **Long-term**: When marker count exceeds 150, migrate background-layer markers from DOM elements to WebGL source layers.

