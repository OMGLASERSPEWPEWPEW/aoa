export interface PatchNote {
  version: string
  date: string
  title: string
  summary: string
  details?: string[]
}

export const CHANGELOG: PatchNote[] = [
  {
    version: '0.4.25',
    date: '2026-08-03',
    title: 'Version stamp on auth pages + admin docs link',
    summary: 'Version now visible on login and signup pages. Admins see a DOCS link in the header.',
    details: [
      'New: version stamp shown on Login and Signup pages',
      'New: admin-only DOCS link in header (Darklight, matti) opens /prototypes/',
    ],
  },
  {
    version: '0.4.24',
    date: '2026-08-03',
    title: 'Username login',
    summary: 'Login now uses username instead of email. Signup collects username + email (for recovery only).',
    details: [
      'Changed: login uses username + password (email never shown)',
      'New: server-side username→email lookup via SECURITY DEFINER function',
      'Changed: signup collects username (required) + email (for account recovery)',
      'New: accounts created for Darklight and matti',
    ],
  },
  {
    version: '0.4.23',
    date: '2026-08-03',
    title: 'Auth session persistence fix',
    summary: 'Sessions now persist reliably across app reopens and deploys.',
    details: [
      'Fixed: explicit auth persistence config (persistSession, autoRefreshToken, PKCE flow)',
      'Fixed: race condition in AuthContext with mounted guard on async callbacks',
      'Added: auth event logging for session diagnostics',
    ],
  },
  {
    version: '0.4.22',
    date: '2026-08-03',
    title: 'Play search + 45 canonical plays',
    summary: 'Discover now searches plays by title and playwright. Seeded 45 canonical plays commonly produced in Chicago.',
    details: [
      'New: plays table seeded with 45 works — classics, modern American, Chicago playwrights, contemporary hits, musicals',
      'New: Discover search matches plays by title and playwright (type "doll house" or "ibsen")',
      'New: play results appear above events with title, playwright, year, synopsis, and first award',
      'New: tapping a play result navigates to the Play detail page',
      'Changed: event search also matches linked play title and playwright',
      'Changed: events query now joins play data for production-to-play connections',
    ],
  },
  {
    version: '0.4.21',
    date: '2026-08-03',
    title: 'iOS keyboard zoom fix + empty states',
    summary: 'Discover search no longer zooms on iOS, show detail always shows cast and photo sections.',
    details: [
      'Fixed: iOS keyboard zoom on Discover search — bumped input to 16px, added maximum-scale=1 to viewport',
      'Fixed: bottom nav disappearing after keyboard dismiss on iOS',
      'New: "THE COMPANY" section always visible — shows "No cast listed" when empty',
      'New: "NO PHOTO AVAILABLE" placeholder in hero when no show/venue photo exists',
    ],
  },
  {
    version: '0.4.20',
    date: '2026-08-03',
    title: 'Map stability + button fixes',
    summary: 'Markers no longer drift during pan, Want to See responds instantly, header date stays on one line.',
    details: [
      'Fixed: map markers drifting/floating during pan — removed CSS transform transition that conflicted with Mapbox positioning',
      'Fixed: "Want to See" button unresponsive — added optimistic updates, error recovery, and .maybeSingle()',
      'Fixed: header date/time wrapping to two lines on mobile (added nowrap)',
      'Added: Mapbox error logging for tile load diagnostics',
      'Fixed: nulled broken venue photos (Chicago Shakespeare tiny icon, Writers Theatre empty image)',
    ],
  },
  {
    version: '0.4.19',
    date: '2026-08-02',
    title: 'Map UX overhaul + date display',
    summary: 'Removed map banner, tonight shows now pop with green borders, header shows date/time, fixed 3 broken venue URLs.',
    details: [
      'Removed: map peek banner ("curtains up within three miles") — was blocking the map',
      'Changed: tonight shows now have green borders instead of small green dot — much more visible',
      'New: header displays current date and time (SAT AUG 2 · 2:45 PM), updates every minute',
      'Fixed: Shattered Globe URL (shatteredglobe.org → sgtheatre.org)',
      'Fixed: A Red Orchid URL (removed www prefix causing redirect)',
      'Fixed: Redtwist Theatre URL nulled (domain dead)',
    ],
  },
  {
    version: '0.4.18',
    date: '2026-08-01',
    title: 'Venue photos + URL validation',
    summary: 'Scraper now extracts venue thumbnail photos from og:image tags and validates website URLs each run.',
    details: [
      'New: venue thumbnails in map venue sheet (extracted from og:image on venue homepages)',
      'New: website URL validation during weekly scraper run — broken URLs logged to scrape_logs',
      'New: photo_url_source column tracks provenance (og_image vs manual) — manual photos never overwritten',
      'Fixed: broken venue photo URLs gracefully fall back to dark placeholder (onError handler)',
    ],
  },
  {
    version: '0.4.17',
    date: '2026-08-01',
    title: 'Map marker clicks fixed for real',
    summary: 'Fixed DOM lifecycle race condition that prevented map markers from opening venue sheets.',
    details: [
      'Fixed: marker DOM elements destroyed mid-click by React re-render — removed selectedVenue from marker useEffect deps',
      'Fixed: added ref-based click flag to prevent Mapbox canvas click from clearing selection',
      'Fixed: venue sheet banner × button now 44px touch target with stopPropagation',
      'Added: separate useEffect for selection styling (scale + glow) without recreating markers',
    ],
  },
  {
    version: '0.4.16',
    date: '2026-08-01',
    title: 'Map fixes + My Shows routing',
    summary: 'Map markers open venue sheets, banner dismisses, and My Shows no longer redirects to login.',
    details: [
      'Fixed: My Shows poster/booking taps navigated to wrong route (/app/production → /app/show)',
      'Fixed: tapping map markers now opens the venue sheet (stopPropagation was missing)',
      'Fixed: banner dismiss now works (tracks dismissed state separately)',
      'Fixed: useProfile error handling + diagnostics logging',
      'Added: error and null-profile fallback UI on Profile page',
    ],
  },
  {
    version: '0.4.9',
    date: '2026-08-01',
    title: 'Cast members + scraper improvements',
    summary: 'Shows now display cast info. Scraper extracts cast, handles longer responses, and populates show times.',
    details: [
      'New: THE COMPANY section on show detail with cast member circles',
      'Scraper now extracts cast_members from venue websites',
      'Fixed: truncated scraper responses (doubled max tokens to 16384)',
      'New: cast_members column on events table',
    ],
  },
  {
    version: '0.4.8',
    date: '2026-08-01',
    title: 'Ticker fix + map emotion colors',
    summary: 'Tonight page now correctly counts shows. Map markers reflect your emotional palette.',
    details: [
      'Fixed: ticker showing 0 shows when events had null end_date',
      'Map markers now show dominant emotion color from your watchlist',
      'Fixed: single-day events excluded from Tonight page',
    ],
  },
  {
    version: '0.4.7',
    date: '2026-08-01',
    title: 'React Query caching',
    summary: 'Page transitions are now instant. Data stays fresh for 5 minutes, background refetches keep it current.',
    details: [
      'Added React Query with 5min staleTime for all data fetching',
      'Tonight, events, and map data now cache between page views',
      'Pinned Node.js to v22 LTS via .nvmrc',
    ],
  },
  {
    version: '0.4.6',
    date: '2026-08-01',
    title: 'Navigation + venue links',
    summary: 'Discover page added to bottom nav. Venue links now validate before rendering. Map banner dismissable.',
    details: [
      'Nav reorder: center FAB is My Shows, slot 4 is Discover',
      'Venue sheet only shows website link for valid http(s) URLs',
      'Map banner now has a close button',
    ],
  },
  {
    version: '0.4.5',
    date: '2026-08-01',
    title: 'Show times + You page fix',
    summary: 'Tonight page now shows curtain times. You page no longer gets stuck loading.',
    details: [
      'Show times displayed on Tonight hero and free section',
      'Fixed: You page infinite loading when signed out',
      'Reviews section relabeled to "WHAT PEOPLE SAID"',
    ],
  },
]
