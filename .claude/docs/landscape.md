# Landscape Analysis: The Art of Art

> **Superseded by detailed analysis at [docs/comp/README.md](../../docs/comp/README.md)** — 20 individual competitor deep dives with feature gap matrix and cross-cutting insights (2026-08-08).

**Date:** 2026-07-30

---

## 1. Competitive Survey

### Theater Listing Platforms

| App | What It Does | Strengths | Weaknesses |
|-----|-------------|-----------|------------|
| **Theater.Guide** | National theater discovery, show schedules, venue info | Comprehensive listings, clean UI, nationwide coverage | No social features, no personalization, no tracking, pure directory |
| **ChicagoPlays.com** | Chicago-specific show finder by League of Chicago Theatres | Official source, comprehensive local listings | Dated UI, no mobile app, no social, no recommendations |
| **Chicago.Theater** | Chicago show schedules and venue calendars | Good schedule views | Listing-only, no curation, no community |
| **HotTix** (hottix.org) | Half-price same-week tickets for Chicago theater | Great deals, supports discovery through deals | Discount-only lens, no social, no tracking, not a discovery tool |

### Tracking/Social Apps (Adjacent Domains)

| App | Domain | What It Does Well | What's Missing |
|-----|--------|-------------------|----------------|
| **Letterboxd** | Film | Beautiful logging, reviews, lists, social, discovery | Film-only. No live performance, no local, no progression |
| **Goodreads** | Books | "Want to read" shelves, reviews, social, annual challenges | Books-only. No events, no venues, no map |
| **Theatregoer** | Theater (UK) | Track shows seen, wishlist, ratings, notes, home screen widgets | UK-focused, no AI, no social feed, no map, no progression, no content |
| **Seen It** | Movies/TV | Want-to-see lists, social following, ratings | Screen media only, no live performance |
| **Bandsintown** | Concerts | Artist tracking, event alerts, map discovery | Music-only, no learning content, no progression |

### Art/Culture Discovery Apps

| App | What It Does | Relevant Ideas | Gaps |
|-----|-------------|-----------------|------|
| **Artwrld** | Map-based art exhibition discovery, personalized art walks | Map UX, guided walks, hidden gem discovery | Visual art only, no theater, no social tracking |
| **Local ARTbeat** | GPS art walks, artist/gallery connections | Self-guided routes, location-based discovery | Regional, no AI, no theater |
| **Street Art Cities** | 65K+ artworks on interactive map across 1800 cities | Map-centric UX, walking routes, massive scale | Street art only, no performances |
| **ArtRabbit** | Exhibition/opening/festival discovery with map | Event calendar, map view, personal art map | Visual art focus, no social tracking |
| **in-yc** | NYC local arts scene on a map — galleries, live music, performances | Community-posted events, neighborhood filtering | NYC-only, no AI, no progression |
| **Google Arts & Culture** | AI city guides, virtual museum tours | AI-powered personalization, massive content | No local theater, no social, no tracking |

## 2. Gap Analysis

### Unserved Needs (no existing product addresses these)

1. **AI-powered theater mentorship** — No app provides a knowledgeable guide who knows your taste, experience level, and city to make personalized theater recommendations
2. **Newcomer onboarding for theater** — No app helps someone go from "I've never seen a play" to "I know the scene" with structured progression
3. **Theater social tracking** — No Letterboxd for theater exists. Theatregoer (UK) is closest but has no social feed, no map, and minimal community
4. **Age/life-stage-aware recommendations** — No app considers where you are in life when recommending cultural experiences
5. **Storefront theater discovery** — Chicago's 200+ small companies are invisible on major platforms

### Poorly Served Needs

1. **Local theater discovery** — Listings exist but curation doesn't. You can find what's playing but not what YOU should see
2. **Theater education for audience members** — Plenty of resources for actors, almost none for developing audiences
3. **Social proof for theater** — No way to see what friends have seen or recommend

### Positioning Statement

Unlike Theater.Guide (a directory), Letterboxd (film-only), or Theatregoer (UK-focused, no AI), **The Art of Art** is a map-based PWA with a named AI mentor who personally guides newcomers into the theater scene, tracks their journey with martial-arts-style progression, and builds a social layer where friends share what they've seen and want to see — starting with Chicago's unmatched storefront ecosystem.

## 3. Content Strategy

### Initial Content (Day One)

| Content Type | Source | Volume |
|-------------|--------|--------|
| Venue profiles | Curated from web research + founder knowledge | 50-100 Chicago theaters |
| Playwright/artist profiles | Curated | 30-50 key figures |
| Genre explainers | AI-generated from domain research, founder-reviewed | 10-15 genres |
| "How to" guides | Adapted from docs/convo-one.md | 5-10 guides |
| Belt level curriculum | Designed from user journey | 6-8 levels |

### Content Update Cadence

| Content Type | Update Frequency | Source |
|-------------|-----------------|--------|
| Events/shows | Weekly (automated scrape + manual curation) | Theater websites, League of Chicago Theatres |
| Reviews | Continuous (user-generated) | Community |
| Venue profiles | Monthly review | AI-assisted updates |
| Learning content | Monthly additions | Curated + AI-generated |

### Cold-Start Problem

The app launches with:
1. **Curated venue/event data** — founder populates the map before launch
2. **AI mentor** — the mentor can answer questions from day one using domain knowledge
3. **Belt progression content** — the learning curriculum exists independently of user-generated content
4. **No social dependency** — the app is useful for a single user (mentor + map + tracking). Social features enhance but don't gate the experience

User-generated content (reviews, ratings, watchlists) grows organically. The app doesn't need a critical mass of users to be valuable — it's useful from user #1.
