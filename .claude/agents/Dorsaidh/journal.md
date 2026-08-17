# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 — Full-Screen Overlays, Drag-to-Dismiss, and Mode Toggles

### What Shipped

Two new threshold surfaces entered the codebase today: `ClassDiscoveryDashboard` (a full-screen `position: fixed, inset: 0` admin overlay) and `ClassSheet` (a bottom-sheet with drag-to-dismiss). A `MapModeControl` segment toggle now switches the map between SHOWS and CLASSES views.

### Drag-to-Dismiss: What the Code Got Right

`ClassSheet` uses the canonical ref-for-transient-state pattern. `dragRef` holds `{ startY, isDragging }` without triggering re-renders; only `dragY` (a `useState`) drives the visual `translateY`. The dismiss threshold is 80px — firm enough to avoid accidental closure, loose enough to feel responsive. The 200ms timeout before calling `onClose` is correct: it lets the exit animation complete before the component unmounts.

One nuance worth encoding: the guard `if (dy > 0)` restricts drag to downward-only. This prevents the sheet from being dragged upward past its natural boundary. That is the right call. Bidirectional drag would require tracking a content-scroll vs. sheet-drag disambiguation, which is a separate and harder problem (see "First Gesture Wins" pattern).

### What the Code Is Missing: Scroll Disambiguation

The current `onTouchMove` does not check whether the sheet's internal `overflowY: auto` content is scrolled. If the user is reading through a long ClassSheet and scrolls down to the teachers section, then lifts and re-drags downward, the drag gesture will fire even though the user's intent was to scroll back up. The fix: check `sheetRef.current.scrollTop === 0` before activating the drag. Only begin tracking `dragY` when the content is scrolled to its top.

```ts
const onTouchMove = useCallback((e: React.TouchEvent) => {
  if (!dragRef.current) return
  const scrollTop = sheetRef.current?.scrollTop ?? 0
  const dy = e.touches[0].clientY - dragRef.current.startY
  if (dy > 0 && scrollTop === 0) {
    dragRef.current.isDragging = true
    setDragY(dy)
  }
}, [])
```

Without this check, users who scroll content inside the sheet will occasionally trigger accidental dismissals. On a 6.1-inch screen with one thumb, the error rate compounds.

### MapModeControl: Segment Toggle Anatomy

The `MapModeControl` component uses `minHeight: 44` on each button — correct minimum, not the 48px floor I recommend for aging-demographic targets, but acceptable given the buttons carry visible count labels that extend their effective visual weight. The `inline-flex` container with `padding: 2` and `backdropFilter: blur(6px)` is a clean iOS-native-feeling segment pattern.

One risk: `backdropFilter` is a compositor-promoted layer. On older iPhones (A12 and earlier), stacking multiple blurred layers on top of a live Mapbox canvas — itself a WebGL compositor layer — can saturate the GPU. If frame rate drops below 45fps during mode transitions, the blur is the first thing to cut.

### Full-Screen Overlay: The Fixed-Inset Problem

`ClassDiscoveryDashboard` uses `position: fixed, inset: 0`. On iOS Safari with the virtual keyboard open, `100vh` (and by extension `inset: 0` on height) does not shrink. The overlay will extend beneath the keyboard, clipping its bottom content. Since this is an admin dashboard accessed from desktop or via the Admin ribbon, the risk is low — but if it ever gains a search input, the keyboard will occlude it. The fix when that moment arrives: listen to `window.visualViewport.resize` and apply `height: window.visualViewport.height` to avoid the keyboard clip.

### Elastic Resistance: A Note on the 80px Threshold

The current dismiss threshold (80px) feels right on a 390px-wide iPhone 14 screen. But it was chosen without a resistance curve. Currently, `dragY` maps 1:1 to `translateY`. Adding a square-root damping curve — `Math.sqrt(dragY) * 8` for the first 40px before going linear — would communicate to the user that the sheet wants to stay up, making the dismiss feel intentional rather than accidental. This is what Apple's own sheets do: they resist, then release.

### Commitments for Next Session

- Add `scrollTop === 0` guard to `ClassSheet.onTouchMove`
- Consider replacing 1:1 drag with elastic resistance curve (sqrt damping first 40px)
- Document `visualViewport` keyboard guard for any full-screen overlay that gains a text input
- MapModeControl blur budget: benchmark on an A12 device before adding any additional blurred overlays to the map canvas

