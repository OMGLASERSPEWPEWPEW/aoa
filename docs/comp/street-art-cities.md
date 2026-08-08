# Street Art Cities

**Category:** art-culture-discovery
**URL:** https://streetartcities.com
**Platforms:** Web, iOS, Android
**Founded:** 2016
**Headquarters:** Heerlen, Netherlands (Street Art Cities B.V.)
**Status:** Active — global scale
**Scale:** 65,000+ artworks, 1,800+ cities, 100+ countries

---

## What They Do

Map-first street art discovery platform that lets people browse, track, and route through murals and street art worldwide. Combines an interactive city map, artist profiles, community-sourced content, and curated walking/cycling routes. Started in 2016 as a photo-sharing project between two street art "hunters" and grew into the largest street art mapping platform in the world. The best-in-class example of map-based cultural discovery at scale.

## Target Audience

- Street art enthusiasts and urban explorers
- Tourists looking for neighborhood walking routes
- Artists wanting to showcase their public work
- Municipalities promoting local street art scenes
- Photographers hunting for murals

**Overlap with AoA:** Medium on product model, low on domain. Street Art Cities maps public art; AoA maps live theater. But the MAP UX is directly comparable — this is the benchmark for how map-based cultural discovery should work at scale.

## Feature Breakdown

| Feature | Details | AoA Overlap |
|---------|---------|-------------|
| Interactive map browsing | Clustered markers, drill into cities | Direct — AoA's core feature |
| Artwork detail pages | Photos, location, artist, description, metadata | Direct — AoA venue/show profiles |
| Artist profiles | Claimed pages with bio, website, social links, portfolio | Adjacent — AoA playwright/artist profiles |
| Community submissions | "Hunters" add artworks to the map | None — AoA uses curated data |
| Walking/cycling routes | Curated multi-stop itineraries | None currently — could be AoA P2 "theater walks" |
| Route builder | Create custom routes, publish to web/app | None |
| Personal collections | Like, collect, mark as "seen" | Direct — AoA watchlist + seen tracking |
| Social features | Follow users, comments, messaging | Direct — AoA social features |
| Edit suggestions | Community can suggest location/status corrections | None |
| Wall timeline | Chronological history of a single wall's murals | None — unique to street art |
| Apple Watch app | Find nearest artwork | None |
| Filter by seen/unseen | Hide already-visited works | Adjacent — AoA could filter "already seen" |

## UX Analysis

### Onboarding
City-centered entry: search or browse the world map, drill into a city. Immediate value — you see artworks on the map without any account setup. Account needed for tracking/social features. Very low friction for discovery, moderate friction for engagement.

### Core Loop
**Open app → browse city map → discover nearby artwork → navigate to it → mark as seen → discover next nearby piece → build collection → share → plan route for next outing.** The loop combines discovery, physical exploration, and collection building. It's action-oriented — the point is to go visit the art, not just browse it online.

### Map/Discovery UX
**This is the benchmark for AoA's map.** Key patterns:

- **Clustered markers** — closely packed works group into numbered clusters (essential for dense areas)
- **Progressive disclosure** — map → artwork card → detail page → artist page
- **Cross-navigation** — artwork page links to artist profile AND to navigation apps (Google Maps) for wayfinding
- **Search across entities** — cities, artists, hunters, festivals from one search bar
- **Seen/unseen filtering** — hide already-visited works (v4 feature). Crucial for "complete the neighborhood" behavior
- **City-centered browsing** — global map → city map. Natural spatial hierarchy

**Known weakness:** Mobile cluster rendering is weaker than web. Closely packed artworks sometimes don't display properly on mobile, with clusters failing to show counts or omitting nearby points.

### Social Features
Follow users, comment on artworks, messaging between users. Community-driven content model where "hunters" are celebrated contributors. Social is lightweight but functional.

### Mobile Experience
Full discovery companion, not a thin web wrapper. Route following, personal galleries, seen-state tracking, social features. Apple Watch support for nearest-artwork queries. But map rendering on mobile has clustering issues in dense areas.

## Business Model

| Revenue Stream | Details |
|---------------|---------|
| Municipality services | Cities use platform to promote street art tourism |
| Artist promotion tools | Profile services for artists |
| Possible featured placements | Sponsored routes/city pages (not confirmed) |

**Pricing:** Free for users. B2B/B2G revenue from municipalities and artists. Business model is opaque from public information — sustainability is uncertain.

## Strengths

- **Best-in-class scope** — 65K+ artworks across 1,800+ cities is massive
- **Map-first UX** is the right model for geographically distributed cultural content
- **Community content model** scales coverage without centralized curation
- **Route planning** turns passive browsing into physical itineraries
- **Artist graph + wall history** adds depth beyond simple pins on a map
- **Multi-sided platform** serving explorers, artists, and municipalities
- **Cross-platform** — web, iOS, Android
- **Seen/unseen filtering** — brilliant for completionist behavior

## Weaknesses

- **Mobile map clustering issues** — dense areas render poorly on phone
- **Community-dependent coverage** — quality varies wildly by city
- **Enthusiast-focused** — can overwhelm casual users who just want one quick recommendation
- **Street art only** — no live events, no performances, no scheduled activities
- **Business model opacity** — unclear how sustainable the platform is
- **No AI/personalization** — no recommendations based on taste
- **No educational content** — no context about art movements, techniques, or history

## What AoA Can Learn

### Steal This
- **Clustered markers** — Essential for dense venues. AoA must implement marker clustering for Chicago's 200+ theaters
- **Progressive disclosure** — Map → card → detail page. Clean information hierarchy
- **Seen/unseen filtering** — Let users filter the map to show only venues/shows they haven't visited yet. Powerful for exploration
- **Cross-navigation to maps apps** — One-tap "navigate here" from venue detail page
- **Route planning / "theater walks"** — "See 3 storefront theaters in Wicker Park tonight" is a killer feature AoA should build
- **Wall timeline → venue timeline** — AoA equivalent: show the history of productions at a venue over time
- **Community contributor celebration** — "Hunters" have status. AoA could celebrate power reviewers
- **City-centered organization** — When AoA expands to multiple cities, use this hierarchy

### Avoid This
- **Don't depend on community submissions for core content** — AoA should curate its own venue/show data rather than relying on user submissions (at least initially)
- **Fix mobile clustering early** — This is Street Art Cities' biggest UX complaint. AoA should get map performance right on mobile from launch
- **Don't be enthusiast-only** — AoA must serve casual newcomers, not just theater power users

### Differentiation Opportunity
- AoA adds **time dimension** (scheduled events, opening/closing dates) that static art doesn't have
- AoA's **AI mentor** provides personalized guidance that Street Art Cities' browse-only model can't match
- AoA's **belt progression** gamifies exploration in a way Street Art Cities doesn't
- AoA's **social tracking + reviews** create community engagement beyond pin dropping
- AoA has **educational content** — explaining what you're about to see, not just where it is

---

**Researched:** 2026-08-08
**Sources:** Perplexity API (sonar-pro), StreetArtCities.com, Google Play, Apple App Store
