# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---


## 2026-08-16 — Art Classes Feature Accessibility Audit

### Context

The art classes discovery feature introduced five new components: ClassDiscoveryDashboard, MapModeControl, LevelPips, ClassSheet, and ClassMarker. Each presents distinct accessibility challenges that map to WCAG 2.1 SC requirements for modal dialogs, custom controls, informational graphics, and touch-only gestures.

### Findings by Severity

**CRITICAL — ClassDiscoveryDashboard: No Focus Trap or Escape-to-Close (SC 2.1.2, 2.4.3)**

The dashboard renders as a `position: fixed; inset: 0; zIndex: 200` overlay, visually covering the entire page. However, it has no focus trap, no `role="dialog"`, no `aria-modal="true"`, and no keyboard listener for Escape. A keyboard user tabbing through the page will focus elements *behind* the overlay — a textbook focus trap violation. The MINIMIZE button exists but is not auto-focused on mount. Fix: wrap in a focus-trap component, add `role="dialog" aria-modal="true" aria-label="Class discovery progress"`, auto-focus the MINIMIZE button on mount, and bind Escape to `onMinimize`.

**CRITICAL — ClassSheet: Drag-to-Dismiss With No Keyboard Alternative (SC 2.1.1, 2.5.1)**

The bottom sheet can only be dismissed by touch-dragging downward (onTouchStart/Move/End) or tapping the backdrop. There is no Escape key binding, no close button, and no keyboard-accessible dismiss mechanism. The "nearby" school items use `onClick` on a `<div>` with no `role="button"`, no `tabIndex`, and no keyboard event handler — completely invisible to keyboard and screen reader users. Fix: add Escape key handler, add a visible close button with `aria-label="Close school details"`, convert nearby school divs to `<button>` elements or add `role="button" tabIndex={0} onKeyDown`.

**MAJOR — MapModeControl: Missing ARIA Roles (SC 4.1.2)**

This is a segmented toggle — semantically a `tablist` with two `tab` options. Currently it renders as two plain `<button>` elements inside a `<div>`, with no `role="tablist"`, no `role="tab"`, no `aria-selected`, and no arrow-key navigation. A screen reader user hears two isolated buttons with no relationship context. Fix: add `role="tablist"` to the container, `role="tab" aria-selected={mode === 'shows'}` to each button, and implement left/right arrow key navigation between them.

**MAJOR — ClassMarker: No Screen Reader Alternative (SC 1.1.1, 4.1.2)**

Map markers are created imperatively via `document.createElement('div')` with no ARIA attributes. The discipline glyphs (symbols like diamond, music note, star) are purely decorative Unicode characters with no `aria-label` or `title`. The click handler is attached to a `<div>` with no `role="button"`, no `tabIndex`, no keyboard handler. These markers are completely invisible to assistive technology. Fix: add `role="button" tabIndex={0} aria-label="${school.name} — ${school.discipline} class${enrolling ? ', enrolling now' : ''}"` to each marker element, and add `keydown` listeners for Enter/Space.

**MAJOR — AMBER_DIM Contrast Failure (SC 1.4.3)**

Measured contrast ratios: AMBER (#D4A017) on AMBER_BG (#1a1005) = 7.89:1 (passes AA). AMBER_DIM (#8a6a10) on AMBER_BG (#1a1005) = 3.70:1 (fails AA for normal text, which requires 4.5:1). The MINIMIZE button text uses AMBER_DIM on AMBER_BG at 9px — well below the large-text threshold. Fix: brighten AMBER_DIM to at least #B08A15 or darken the background further.

**MINOR — LevelPips: Partial Win, Needs Role (SC 1.1.1)**

LevelPips already has `aria-label="Level ${level} of 5"` — good. However, the component lacks `role="img"` on the container, which means screen readers may try to traverse the five child divs individually instead of treating the whole thing as a single graphic. Add `role="img"` to the outer div.

**MINOR — ProgressArc SVG: No Accessible Name (SC 1.1.1)**

The semicircular progress arc has no `<title>` element inside the SVG and no `aria-label`. A screen reader cannot interpret it at all. Fix: add `role="img" aria-label="${processed} of ${total} schools processed"` to the SVG element, or nest a `<title>` element.

**MINOR — ActivityLog Status Colors (SC 1.4.1)**

Error status is communicated solely through red text color (`#ef4444`) with no icon, prefix, or other non-color indicator. Users who cannot perceive red will miss error states entirely. Fix: prepend an icon or text label like "ERROR:" before the status text.

### Commitments for Next Session

1. Draft a focus-trap utility (or adopt an existing one like `focus-trap-react`) usable by both ClassDiscoveryDashboard and ClassSheet.
2. Propose an accessible map marker pattern that works with Mapbox GL's imperative marker API — likely a visually-hidden off-map listing as the accessible alternative, since Mapbox canvas markers are inherently inaccessible.
3. Review the VenueSheet for parity — it likely has the same drag-to-dismiss and keyboard issues as ClassSheet.
