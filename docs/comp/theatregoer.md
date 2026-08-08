# Theatregoer

**Category:** tracking-social
**URL:** https://apps.apple.com/us/app/theatregoer-theatre-tracker/id1540656306
**Platforms:** iOS only (iPhone, iPad, Mac via Apple Silicon, Vision Pro)
**Founded:** ~2020 (App Store listing ID suggests late 2020)
**Headquarters:** Unknown (likely UK-based given spelling and focus)
**Status:** Active — indie developer, free app
**Rating:** 4.9/5 (7 ratings on App Store)

---

## What They Do

Personal theater log and discovery app for tracking shows attended and shows you want to see. Theatregoer is the closest thing to "Letterboxd for theater" that currently exists — it lets users add shows, attach tickets, rate performances, write notes, view stats, and share with friends. It is NOT a ticketing app; its core value is helping users remember, organize, and analyze their theater-going history.

## Target Audience

- Enthusiast theatergoers who attend many productions per year
- Collectors/archivists who want structured memory of shows, seats, venues, dates
- Social theater fans who want to share what they saw
- Data-oriented users who enjoy attendance stats and trends
- UK-focused (spelling, venues, likely data sources)

**Overlap with AoA:** Very high — this is the most direct competitor to AoA's tracking features. But Theatregoer is a personal log, not a discovery/mentorship platform. No AI, no map, no progression, no content.

## Feature Breakdown

| Feature | Details | AoA Overlap |
|---------|---------|-------------|
| Show tracking | Add shows with time, theater, seats, details | Direct |
| Upcoming shows | Track future bookings | Direct — AoA "want to see" |
| Past show archive | Browse attendance history | Direct — AoA "seen" |
| Ticket attachment | Attach tickets from email | None — AoA doesn't handle tickets |
| Ratings | Rate shows | Direct |
| Notes | Personal notes per show | Adjacent — AoA has reviews |
| Search | Search show history | Direct |
| Statistics | Insights into attendance, ratings, trends | Adjacent — AoA has stats |
| Home screen widgets | Upcoming shows + "On This Day" memories | None (PWA limitation) |
| Sharing | Share shows with Theatregoer friends | Direct — AoA has social |
| Wishlist | Shows you want to see | Direct |
| Dark mode | Full dark mode support | Direct — AoA supports dark mode |
| iCloud sync | Cross-device sync | Adjacent — AoA uses Supabase cloud |
| Spreadsheet import | Import existing show logs | None |

## UX Analysis

### Onboarding
Straightforward — install, start logging shows. Spreadsheet import reduces manual setup for users with existing records. Ticket attachment from email provides a low-friction path for importing real-world theater receipts.

### Core Loop
**Add show → attach ticket → attend → rate and note → review stats and memories → share → repeat.** Strong retention loop combining utility, memory preservation, and light social reinforcement. The "On This Day" widget creates nostalgia-driven re-engagement.

### Map/Discovery UX
No map. No discovery. Theatregoer is purely a personal log — you need to already know what shows exist. There's no browse, no recommendations, no curated content.

### Social Features
Light social layer — share shows with friends who also use the app. No activity feed, no public profiles, no community reviews. Social is limited to direct sharing between contacts.

### Mobile Experience
Apple ecosystem only (iPhone, iPad, Mac, Vision Pro). Widgets are a standout feature — upcoming shows and "On This Day" memories on the home screen create ambient engagement. Dark mode is practical for in-theater use.

## Business Model

| Revenue Stream | Details |
|---------------|---------|
| Free app | No apparent monetization |

**Pricing:** Free. No in-app purchases or subscriptions visible. This appears to be a passion project by an indie developer with no clear revenue model.

## Strengths

- Clear niche focus — theater tracking, nothing else
- Rich personal record-keeping (show details, seats, notes, ratings, tickets)
- Widgets create ongoing engagement beyond active logging
- iCloud sync for Apple ecosystem continuity
- Spreadsheet import is valuable for power users
- High App Store rating (4.9/5)
- Simple, focused UX

## Weaknesses

- **Apple-only** — no Android, no web. Excludes most of the market
- **No discovery** — you need to already know what shows exist
- **No AI or recommendations** — purely manual logging
- **No map** — no location-based features
- **No progression or gamification** — just a log
- **Tiny user base** — only 7 App Store ratings suggests very small adoption
- **No content** — no educational material, no venue profiles, no artist info
- **UK-focused** — not localized for US/Chicago theater scene
- **No business model** — sustainability is questionable without revenue
- **Light social** — sharing only, no community, no feeds, no public profiles
- **Currency bug** — users report different currencies appearing on different devices

## What AoA Can Learn

### Steal This
- **"On This Day" memories** — Powerful nostalgia feature. AoA should show "1 year ago you saw [show] at [venue]" to drive re-engagement
- **Ticket attachment** — Letting users save their ticket stubs/confirmations alongside show entries adds archival value
- **Spreadsheet import** — For early adopters who've been tracking shows manually, this reduces switching cost
- **Widget-first engagement** — Home screen presence keeps the app top-of-mind (though PWA widget support is limited)

### Avoid This
- **Apple-only** — AoA as a PWA is cross-platform from day one. This is a huge advantage
- **No discovery engine** — A tracker without discovery is only half a product. Theatregoer requires users to find shows elsewhere
- **No business model** — Without revenue, the app could disappear at any time. AoA should plan monetization early
- **Tiny social graph** — Sharing requires friends to also have the app. AoA's web-based social features lower this barrier

### Differentiation Opportunity
- AoA does **everything Theatregoer does PLUS** map-based discovery, AI mentorship, belt progression, community reviews, educational content, and venue profiles
- AoA is **cross-platform** (PWA) vs. Apple-only
- AoA has a **business model** path (freemium, potentially ticket partnerships)
- AoA is **US/Chicago-first** vs. UK-focused
- Theatregoer proves the "personal theater log" concept has demand — AoA just needs to execute it better with a broader feature set

## Related Competitors (discovered during research)

| App | What It Does | Notes |
|-----|-------------|-------|
| **Aklaim** | Musical tracker — ratings, reviews, wishlist, calendar | Focuses specifically on musicals |
| **TheaterRecords** | Theater log — ticket scanning, stats, widgets, map, seat analysis | More advanced logging/analytics |
| **BroadwayWorld "My Shows"** | Track shows, ratings, reviews, friends, stats, venues | Tied to BroadwayWorld ecosystem |
| **StagePort** | Digital scrapbook with emotion tags, badges, friend stat comparison | Has gamification elements close to AoA |
| **CritiCal** | Built for theater critics — structured review tool | Niche professional tool |
| **Playbill Passport** | In-theater companion + archival memory | Content platform + tracker hybrid |

---

**Researched:** 2026-08-08
**Sources:** Perplexity API (sonar-pro), Apple App Store, Stage and Cinema, Musical Theatre Review
