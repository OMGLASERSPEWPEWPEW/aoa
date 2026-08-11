# PRD: Admin Scrape Ribbon

**Date:** 2026-08-11
**Size:** Small
**Status:** Draft

---

## Problem

The scraper batch loop runs in CoverageTab local state. Navigating away kills the loop. The admin has to sit on the Coverage tab for 30+ minutes watching it run.

## Solution

Move scraper state into a React context. Add a persistent ribbon component in App.tsx (like glyffitimobile's InscriptionRibbon) that shows progress from any page. Only visible to admins. Hides on the Coverage tab (no double UI). Auto-hides after completion.

## Functional Requirements

### FR-1: ScrapeContext

**Trigger:** App mounts.

**Behavior:** A React context provides:
- `discoveryProgress: { phase, found, enriched, promoted, total, error }` — same shape as current CoverageTab `progress` state
- `scraperProgress: { phase, scraped, events, error }` — same shape as current `scraper` state
- `busy: boolean` — true when either is running
- `runDiscovery()` — starts discovery + enrichment loop (moved from CoverageTab's `handleRunDiscovery`)
- `runScraper()` — starts scraper batch loop (moved from CoverageTab's `handleRunScraper`)
- `refetchMetrics: () => void` — passed through so Coverage tab can still refresh metrics

The context wraps the app inside `<AuthProvider>` in App.tsx. The batch loops run here — navigating away doesn't kill them because the context persists across route changes.

**Error state:** Same as current — errors stored in progress state, displayed by ribbon and Coverage tab.

**Scope boundary:** The context only holds scraper/discovery state and handlers. It does NOT hold coverage metrics, queue data, or audit data — those stay in their hooks, consumed by CoverageTab directly.

### FR-2: AdminScrapeRibbon Component

**Trigger:** Admin triggers Run Discovery or Run Scraper from the Coverage tab.

**Behavior:** A thin ribbon appears below the header (or above the main content) showing:
- A 2px animated shimmer bar (gold, matching `--accent`)
- Caption: "Scraping... 15/111 venues, 42 events found" or "Discovering... Adding 30 venues" or "Done — 85 events found"
- Uses Courier Prime monospace, 9-10px, same as the rest of the admin UI

**Visibility rules:**
- Only renders for admin users (username in `['darklight', 'matti']`)
- Hides when `phase === 'idle'` (nothing running, nothing recently completed)
- Hides when on the Coverage tab (`/app/admin` with Coverage selected) to avoid double UI
- Shows on all other pages while a loop is running
- After completion (`phase === 'done'`), stays visible for 5 seconds then auto-hides

**Render location:** In `App.tsx`, after `<UpdateBanner />`, before `<Routes>`. Inside the `<AuthProvider>` so it can access auth state.

**Error state:** If the loop hits an error, ribbon shows "Scraper error: {message}" in red for 5 seconds then hides.

### FR-3: Refactor CoverageTab

**Trigger:** Code change — not user-facing.

**Behavior:** CoverageTab consumes `ScrapeContext` instead of owning discovery/scraper state. The "Run Discovery" and "Run Scraper" buttons call `runDiscovery()` and `runScraper()` from the context. Progress display reads from context state. The buttons still show inline progress ("Discovering...", "Adding 30...", "Scraping 15...") same as before.

**Scope boundary:** Only moves state ownership. No visual changes to the Coverage tab itself.

### FR-4: Shared ADMINS Constant

**Trigger:** Code change.

**Behavior:** Extract `const ADMINS = ['darklight', 'matti']` from `Header.tsx` into a shared constant (e.g., `src/lib/constants.ts` or inline in both files). Both `Header.tsx` and `AdminScrapeRibbon.tsx` import from the same source.

## Architecture

### New files
| File | Purpose |
|------|---------|
| `src/contexts/ScrapeContext.tsx` | Context provider with discovery + scraper state and handlers |
| `src/components/AdminScrapeRibbon.tsx` | Persistent ribbon component |

### Modified files
| File | Change |
|------|--------|
| `src/App.tsx` | Wrap with `<ScrapeProvider>`, render `<AdminScrapeRibbon />` |
| `src/pages/Docs.tsx` | CoverageTab consumes context instead of owning state; remove `handleRunDiscovery`, `handleRunScraper`, `progress`, `scraper`, `busy` from local state |
| `src/components/Header.tsx` | Extract ADMINS to shared constant |

### Prior art
| Pattern | File | Reuse |
|---------|------|-------|
| InscriptionRibbon design | glyffitimobile `InscriptionRibbon.tsx` | Layout, shimmer animation, auto-hide pattern |
| Admin check | `Header.tsx` line 8, 21 | Same ADMINS array + useProfile check |
| Context pattern | `AuthContext.tsx` | Provider/hook pattern |
| Batch loop handlers | `Docs.tsx` lines 395-486 | Move verbatim into context |

### No database changes. No backend changes.
