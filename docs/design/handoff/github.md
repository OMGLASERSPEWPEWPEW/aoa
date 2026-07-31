repo: OMGLASERSPEWPEWPEW/aoa
branch: main
path: src, .claude/docs

secondary-repo: OMGLASERSPEWPEWPEW/GlyffitiMobile
secondary-branch: main
secondary-path: src/index.css, tailwind.config.ts, docs/web

## Last sync
date: 2026-07-31T18:51:51Z

### Updated in this project
- Read AOA's product docs (domain research, user journey, belt model) and app source to ground the tracker design.
- Lifted Glyffiti's visual language from its CSS tokens: paper/ink palette, Newsreader + Courier Prime + JetBrains Mono, hairline rules, gold accent.
- Built a mobile Goodreads-style plays-seen tracker for AOA in Glyffiti's editorial style.
- Replaced belts with "The House" (Standing Room → Company) and star ratings with an emotion wheel.

## Screen map
| Screen | Built from |
|---|---|
| Tonight (home feed) | aoa src/pages/Discover.tsx, src/components/EventCard.tsx |
| My Shows 1a / 1b | aoa src/pages/Watchlist.tsx, src/lib/types.ts (WatchlistStatus) |
| Show detail + reviews | aoa src/pages/Discover.tsx (EventDetail), src/components/ReviewCard.tsx |
| Log a show | aoa src/components/LogShowModal.tsx, useBeltCheck.ts |
| Write a review | aoa src/components/ReviewForm.tsx |
| You / The House | aoa src/pages/Profile.tsx, .claude/docs/user-journey.md |
| Discover | aoa src/pages/Discover.tsx |
| Visual system (all) | GlyffitiMobile src/index.css, tailwind.config.ts |
