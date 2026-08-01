export interface PatchNote {
  version: string
  date: string
  title: string
  summary: string
  details?: string[]
}

export const CHANGELOG: PatchNote[] = [
  {
    version: '0.4.13',
    date: '2026-08-01',
    title: 'Profile page fix (third attempt)',
    summary: 'You page now handles all failure modes: query errors, null profile, and hooks ordering. Diagnostics logging added to trace profile loading.',
    details: [
      'Fixed: useProfile silently swallowed Supabase query errors — now logs via diagnostics and surfaces errors',
      'Added: error state and null-profile fallback UI on Profile page',
      'Added: diagnostic breadcrumbs for profile loading lifecycle',
      'Prior: hooks ordering violation fix (v0.4.12), loading state fix (v0.4.5)',
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
