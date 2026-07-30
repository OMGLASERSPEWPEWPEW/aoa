# Product Requirements Document: The Art of Art

**Date:** 2026-07-30
**Version:** 1.0
**Status:** Draft

---

## 1. App Identity

**Name:** The Art of Art
**Tagline:** Your guide to the scene.
**Description:** A map-centric PWA with a named AI mentor who guides newcomers into their city's theater scene through personalized recommendations, Goodreads-style tracking, martial-arts-belt progression, and a social layer — starting with Chicago.

## 2. Target Users

**Primary:** The Curious Newcomer — taking acting classes or newly interested in theater, 20s-40s, urban, wants guidance not gatekeeping.

**Secondary:** Lapsed theatergoers, city relocators, theater students.

**Anti-personas:** Professional critics, casual tourists, deal-hunters-only.

## 3. Agent Persona

**Name:** TBD during implementation (founder to choose)
**Backstory:** A theater-obsessed Chicagoan who's seen everything, knows everyone, and genuinely wants to share the love. Not pretentious. Thinks the Neo-Futurists are just as important as Steppenwolf. Has opinions but respects yours.

**Voice & Tone:**
- Warm, knowledgeable, slightly irreverent
- Uses "you'd love this" not "you should see this"
- Drops real insider knowledge naturally
- Adjusts formality based on user's belt level (more guiding at White, more conversational at Green+)
- Never condescending, never gatekeeping

**Personality Traits:**
1. Enthusiastic without being overwhelming
2. Opinionated but open-minded
3. Locally rooted (knows Chicago deeply)
4. Warm and encouraging
5. Real-talk (honest about what's good and what's skippable)

**Visual:** Avatar with distinct character design. Speech bubbles for chat. Appears on map as a small persistent icon.

**Knowledge Boundaries:**
- Knows: Chicago theater scene, playwrights, genres, venues, history, industry dynamics
- Defers on: ticket purchasing, personal schedules, non-theater topics
- Adapts to: user's age range, experience level, stated interests

## 4. Core User Stories (MVP)

| # | Story | Priority |
|---|-------|----------|
| US-1 | As a newcomer, I want an AI mentor to recommend my first show so I know where to start | P0 |
| US-2 | As a user, I want to see theaters and events on a map so I can find what's near me | P0 |
| US-3 | As a user, I want to add shows to a "want to see" list so I can plan what to attend | P0 |
| US-4 | As a user, I want to mark shows as "seen" and rate them so I can track my journey | P0 |
| US-5 | As a user, I want to learn about theaters, playwrights, and genres through bite-sized content so I feel less intimidated | P0 |
| US-6 | As a user, I want to earn belt levels as I engage so I feel a sense of progression | P1 |
| US-7 | As a user, I want to see friends' activity and recommendations so I can discover through my social circle | P1 |
| US-8 | As a user, I want to write and read reviews so I can share opinions and discover based on community taste | P1 |

## 5. Feature Inventory (MVP) — P0: Launch Blockers

| # | Feature | Description |
|---|---------|-------------|
| F-1 | **Map home screen** | Interactive map as primary navigation. Theater/venue markers with icons by type (theater, class, event). Tap marker → venue card with current shows, distance, description. User location dot. Neighborhood labels. |
| F-2 | **AI mentor chat** | Named character with avatar. Speech bubble UI. Conversational recommendations based on user profile (age, interests, belt, history). Persistent chat history. Suggested prompts for new users. Powered by AI gateway (Claude). |
| F-3 | **Venue profiles** | Detail page per venue: name, photo, address, map pin, description, current/upcoming shows, genre tags, price range, venue type (storefront/institutional/experimental), accessibility info. |
| F-4 | **Event listings** | Shows, classes, workshops, festivals. Each with: title, venue, dates, times, price, genre tags, description, "want to see" button. Filterable by date, genre, price, venue. |
| F-5 | **Watchlist ("Want to See")** | Add/remove events. Three states: "want to see" / "seeing" / "seen". List view with sort/filter. Quick-add from map markers and event cards. |
| F-6 | **Show logging ("Seen")** | Mark event as seen. Rate 1-5 stars. Optional quick reflection (one-liner) or detailed review. Date seen auto-populated. Stats: total shows, venues visited, genres explored. |
| F-7 | **Learning modals** | Bite-sized educational content triggered by map icons or mentor suggestions. Topics: venue histories, playwright profiles, genre explainers, "how to" guides (ushering, opening nights, talking to actors). Card-based UI, swipeable. |
| F-8 | **Onboarding flow** | Age range, city, experience level, interest selection (3 picks). Mentor introduces themselves. First recommendation generated. Total time < 2 minutes. |
| F-9 | **Auth** | Sign up (email + password), login, Google OAuth, Apple OAuth. Protected routes for all app features. Profile page with belt display. |
| F-10 | **PWA shell** | Installable PWA. Offline: cached venue data, watchlist accessible, mentor chat shows last messages. Push notification ready (infrastructure only in MVP). |

## 6. Feature Inventory (MVP) — P1: Launch Targets

| # | Feature | Description |
|---|---------|-------------|
| F-11 | **Belt progression** | White through Black belt system. Criteria tracked automatically (shows seen, reviews written, venues visited, etc.). Visual belt indicator on profile and in mentor chat. Unlock animations. Feature gating per belt level (see user-journey.md). |
| F-12 | **Social: friends** | Add friends by username/link. Friends list. See friends' recently seen shows and watchlists. Activity feed (friend saw X, friend added Y to watchlist). |
| F-13 | **Community reviews** | Full review writing (title, body, rating, tags). Review feed per event. Aggregate community rating. Helpful/not helpful voting. Spoiler tags. |
| F-14 | **Age-based recommendations** | Mentor tailors recommendations based on age range selected in onboarding. Content framing adjusts (20s: "perfect for a cheap night out" vs. 40s: "this is the kind of work that rewards experience"). |
| F-15 | **Acting class listings** | Map markers for acting classes/workshops. Detail cards with: school name, class type, level, schedule, price, location. "Interested" tracking. |

## 7. Feature Inventory — P2: Fast Follow

| # | Feature | Description |
|---|---------|-------------|
| F-16 | **Push notifications** | Show reminders (day before "want to see" events), friend activity, new shows at followed venues, belt advancement celebrations |
| F-17 | **Curated lists** | User-created lists ("Best storefront shows 2026," "First-timer essentials"). Public/private. Shareable links. |
| F-18 | **Theater company follow** | Follow specific companies for updates. Company profiles with history, ensemble, upcoming season. |
| F-19 | **Season planner** | Calendar view of your "want to see" list. Conflict detection. Season overview across companies. |
| F-20 | **Recommendation engine** | "Because you liked X" algorithmic recommendations. Genre affinity profile. Collaborative filtering from similar users. |
| F-21 | **Multi-city expansion** | City selector. Same features, different venue/event data. Start with 2-3 cities after Chicago validates. |

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Load time** | First contentful paint < 2s on 4G |
| **Map performance** | Smooth pan/zoom with 200+ markers |
| **Offline** | Cached venue data, watchlist, last mentor messages |
| **Accessibility** | WCAG 2.1 AA. Screen reader support for map markers. |
| **Mobile-first** | Designed for 375px width. Desktop is secondary. |
| **Supported devices** | iOS Safari 15+, Chrome 90+, Samsung Internet |
| **Install** | PWA installable on iOS and Android |

## 9. Monetization Model

**Phase 1 (Launch):** Free. No monetization. Focus on user acquisition and engagement.

**Phase 2 (Post-validation):** Options to explore:
- Premium mentor features (deeper conversations, personalized season planning)
- Theater company partnerships (promoted listings, not ads)
- Credit system for premium content (using existing Stripe pattern)

## 10. Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| **Registered users** | 1,000 |
| **MAU** | 400 (40% of registered) |
| **Shows logged per user per month** | 1.5 |
| **Watchlist items per active user** | 5+ |
| **Mentor conversations per user per week** | 2 |
| **Belt advancement** | 50% of users reach Yellow (1 show seen) within 30 days |
| **Social adoption** | 30% of Orange+ users have 2+ friends |

## 11. Content Architecture

| Content Type | Structure | Source | Update |
|-------------|-----------|--------|--------|
| **Venues** | Name, location, type, description, photos, tags, shows | Curated seed data + community | Monthly review |
| **Events** | Title, venue, dates, genre, price, description | Curated + automated scraping | Weekly |
| **Learning content** | Title, body, category, belt requirement, related venues | Curated + AI-generated | Monthly additions |
| **Reviews** | Title, body, rating, author, event, date, helpful votes | User-generated | Continuous |
| **Watchlist entries** | User, event, status (want/seeing/seen), rating, date | User-generated | Continuous |

## 12. City/Region Model

**Launch:** Chicago only. All data, recommendations, and mentor knowledge scoped to Chicago.

**Expansion:** Each city gets its own venue/event dataset. The mentor's personality stays the same but knowledge adapts. The belt system is city-agnostic (shows in any city count). Social features work across cities.

**Data model:** `city` field on venues and events. User `home_city` in profile. Mentor system prompt includes city-specific knowledge.
