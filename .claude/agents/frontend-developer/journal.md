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
