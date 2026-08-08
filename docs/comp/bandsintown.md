# Bandsintown

**Category:** tracking-social / art-culture-discovery
**URL:** https://www.bandsintown.com
**Platforms:** Web, iOS, Android (+ distribution into Spotify, Apple Music, YouTube, Google, Shazam, Amazon Music)
**Founded:** 2007
**Headquarters:** New York, NY
**Status:** Active — massive scale
**Scale:** 100M registered fans, 700K artists, 65K venues, 40M MAU

---

## What They Do

Live-music discovery and fan-tracking platform. Users follow artists, get alerts when those artists announce nearby shows, discover concerts based on taste and location, and buy tickets. Bandsintown also operates a B2B side — artist tools (Bandsintown for Artists) and venue/promoter tools (Bandsintown Pro) for event distribution and marketing. Recently added an AI assistant for show discovery.

The most relevant comparison to AoA: Bandsintown does for concerts what AoA aims to do for theater — taste-based, location-aware discovery of live events with tracking and social features.

## Target Audience

- Concert-goers who follow specific artists and want tour alerts
- Music fans seeking nearby shows they might not know about
- Artists needing to distribute tour dates across platforms
- Venues and promoters distributing events to fans

**Overlap with AoA:** High on product model, low on domain. Bandsintown's follow-to-alert-to-discovery loop is the closest analog to what AoA's "follow theater companies → get recommendations" feature could be. The location-aware discovery and tracking patterns are directly applicable.

## Feature Breakdown

| Feature | Details | AoA Overlap |
|---------|---------|-------------|
| Follow artists | Track favorite artists, get alerts on new events | Direct — AoA "follow theater companies" (P2) |
| Event alerts | Push notifications when followed artists announce shows | Direct — AoA push notifications (P2) |
| Personalized recommendations | Shows suggested by taste + location | Direct — AoA AI mentor recommendations |
| Map/location discovery | Browse nearby shows | Direct — AoA map discovery |
| City/genre browsing | City charts, genre filtering | Direct — AoA neighborhood/genre filtering |
| Ticket purchase | Buy tickets in-app | None — AoA doesn't sell tickets |
| RSVP/tracking | Track shows you plan to attend | Direct — AoA "want to see" |
| Streaming integration | Events appear in Spotify, Apple Music, etc. | None — theater has no streaming equivalent |
| AI assistant | In-app AI for show discovery (new) | Direct — AoA AI mentor |
| Artist tools | Event distribution, analytics, fan data | None |
| Live Music Charts | Trending artists/tours as discovery layer | Adjacent — AoA could have "trending shows" |
| Email campaigns | Personalized fan emails at scale | Future — AoA email engagement |

## UX Analysis

### Onboarding
Preference-collection flow: follow artists to bootstrap recommendations. Integrates with streaming services (Spotify, Apple Music) to auto-detect taste. Solves the cold-start problem quickly — follow a few artists, get immediately relevant results.

### Core Loop
**Follow artist → artist announces show → Bandsintown pushes alert → discover show → buy ticket → attend → discover related artists nearby → follow more → repeat.** The explicit follow graph feeds recommendation quality over time. Each interaction improves future suggestions.

### Map/Discovery UX
Heavily location-first — surfaces shows near the user. Combines taste signals (follows, streaming history, click behavior) with geographic relevance. City-specific discovery and live charts support browsing beyond explicit follows. Not a detailed interactive map in the Street Art Cities sense, but location is the primary filter.

### Social Features
Artist-fan connections are the primary social graph. Email fan outreach at massive scale (450M+ personalized recommendations). No user-to-user social features — you follow artists, not friends.

### Mobile Experience
Mobile-first — concerts are an on-the-go, time-sensitive use case. Discovery, alerts, and ticket purchase optimized for phone. New AI assistant reduces search friction for "find me something tonight" scenarios.

## Business Model

| Revenue Stream | Details |
|---------------|---------|
| Bandsintown Pro | Paid tools for venues/festivals/promoters |
| Artist marketplace | 30+ integrations (distribution, merch, CRM, analytics) |
| Ticket click-through | Commission/referral on ticket purchases |
| Advertising | Brand access to 100M music fans |
| Data/analytics | Fan insights for artists and promoters |

**Pricing:** Free for fans. Bandsintown for Artists has free tier (basic analytics). Pro tools for venues/promoters are paid (pricing not public).

## Strengths

- **Massive scale** — 100M fans, 700K artists, 65K venues
- **Strong follow-to-alert loop** — habitual, passive engagement
- **Distribution breadth** — events appear across Spotify, Apple Music, YouTube, Google, Shazam, Amazon Music
- **Location-first discovery** — shows near you, right now
- **AI assistant** — reducing friction for spontaneous discovery
- **Multi-sided platform** — fans, artists, venues all benefit
- **Email at scale** — 450M+ personalized recommendations

## Weaknesses

- **Music only** — no theater, no performing arts
- **Repetitive recommendations** — can over-index on familiar genres
- **Artist adoption dependency** — value drops for artists not on platform
- **No user-to-user social** — follow artists, not friends. No community
- **No tracking/logging** — no equivalent of "seen" with ratings/reviews
- **No educational content** — assumes you already know what you like
- **No progression/gamification** — no badges, levels, or achievements
- **Pricing opaque** — B2B pricing not publicly documented

## What AoA Can Learn

### Steal This
- **Follow-to-alert loop** — AoA should let users follow theater companies and get alerts when they announce new shows. This is the killer engagement mechanic
- **Streaming service taste import** — Bandsintown bootstraps taste from Spotify. AoA can't do this for theater, but could ask "what shows have you seen?" or import from Theatregoer/spreadsheet
- **AI assistant for discovery** — Bandsintown added AI for "find me something tonight." AoA already has the AI mentor — validate it works for spontaneous discovery
- **Location + taste + time** — The three-signal recommendation model (where you are + what you like + when you're free) is the right framework for live event discovery
- **Personalized email campaigns** — When AoA has enough users, personalized "shows near you this week" emails could drive engagement
- **City charts / trending** — A "what's hot in Chicago theater this week" leaderboard could drive discovery

### Avoid This
- **No user-to-user social** — Bandsintown's social graph is artist-to-fan only. AoA must have friend-to-friend social
- **No logging/tracking** — Bandsintown doesn't remember what you've attended. AoA must track and celebrate attendance history
- **No educational layer** — Bandsintown assumes taste. AoA must develop taste in newcomers

### Differentiation Opportunity
- AoA does for **theater** what Bandsintown does for **music** — but with added social tracking, belt progression, AI mentorship, and educational content
- AoA's **friend-to-friend social** goes beyond Bandsintown's artist-to-fan model
- AoA's **belt progression** gamifies what Bandsintown leaves flat
- AoA's **AI mentor with personality** is deeper than Bandsintown's generic AI assistant

---

**Researched:** 2026-08-08
**Sources:** Perplexity API (sonar-pro), Bandsintown.com, multiple industry reports
