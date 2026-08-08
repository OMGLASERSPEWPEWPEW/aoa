# Competitive Landscape — The Art of Art

**Last updated:** 2026-08-08
**Competitors analyzed:** 20
**Research method:** Perplexity API (sonar-pro) + WebSearch + WebFetch per competitor

---

## AoA Positioning

**The Art of Art** is a map-centric PWA with a named AI mentor who personally guides newcomers into the theater scene, tracks their journey with martial-arts-style belt progression, and builds a social layer where friends share what they've seen and want to see — starting with Chicago's unmatched storefront theater ecosystem.

No existing product combines all of these: **map-based discovery + AI mentorship + social tracking + gamified progression + educational content + newcomer onboarding**. Every competitor does one or two of these. None does all six.

---

## Master Comparison

### Theater Discovery + Ticketing

| Competitor | What They Do | Users/Scale | Key Differentiator | AoA Overlap | Deep Dive |
|-----------|-------------|-------------|-------------------|-------------|-----------|
| **TodayTix** | Rush/lottery tickets | 10M+ downloads | Scarcity-based deal mechanics | Discovery, watchlist | [details](todaytix.md) |
| **ChicagoPlays** | Official Chicago theater listings | 200+ theaters, 1K+ shows | League authority, accessibility calendar | Listings, discovery | [details](chicagoplays.md) |
| **HotTix** | Half-price Chicago tickets | 150+ theaters, 40+ years | Chicago institution, deep local network | Price discovery | [details](hottix.md) |
| **BroadwayWorld** | Theater news + database + community | Largest theater site | News + forums + My Shows tracking | Tracking, community | [details](broadwayworld.md) |
| **Playbill** | Theater media + digital programs | 140+ year brand | Iconic physical program, Passport app | Tracking (Passport) | [details](playbill.md) |
| **TheaterMania** | Listings + reviews + deals | Medium traffic | Reviews alongside deals | Reviews | [details](theatermania.md) |
| **Show-Score** | Ratings aggregator | Likely defunct | Single aggregate score | Ratings | [details](show-score.md) |
| **Theater.Guide** | National directory | Low traction | National scope | Listings | [details](theater-guide.md) |

### Tracking + Social

| Competitor | What They Do | Users/Scale | Key Differentiator | AoA Overlap | Deep Dive |
|-----------|-------------|-------------|-------------------|-------------|-----------|
| **Letterboxd** | Film tracking/social | 30M+ users | Gold standard logging + social UX | Core UX model | [details](letterboxd.md) |
| **Goodreads** | Book tracking/social | 90-150M users | Massive scale, network effects | Cautionary tale | [details](goodreads.md) |
| **Theatregoer** | Theater tracking (UK) | ~7 ratings | Closest direct competitor | Direct competitor | [details](theatregoer.md) |
| **Seen It** | Movie/TV tracking | Niche | Simple tracking UX | Tracking mechanic | [details](seen-it.md) |
| **Bandsintown** | Concert tracking + discovery | 100M fans, 700K artists | Follow-to-alert loop, AI assistant | Discovery + tracking model | [details](bandsintown.md) |

### Art/Culture Discovery

| Competitor | What They Do | Users/Scale | Key Differentiator | AoA Overlap | Deep Dive |
|-----------|-------------|-------------|-------------------|-------------|-----------|
| **Artwrld** | Map-based art discovery | NYC + LA, 1,100+ galleries | "AllTrails for art" — closest map UX comp | Map UX model | [details](artwrld.md) |
| **Street Art Cities** | Map-based street art | 65K artworks, 1,800 cities | Best-in-class map + routes at scale | Map UX benchmark | [details](street-art-cities.md) |
| **ArtRabbit** | Exhibition discovery | UK/Europe focus | Editorial curation + artist subscriptions | Discovery + save | [details](artrabbit.md) |
| **Google Arts & Culture** | Virtual museum exploration | Google scale | AI-powered cultural discovery | AI concept | [details](google-arts-culture.md) |

### Deal/Ticketing Platforms

| Competitor | What They Do | Users/Scale | Key Differentiator | AoA Overlap | Deep Dive |
|-----------|-------------|-------------|-------------------|-------------|-----------|
| **Goldstar** | Discounted event tickets | 10M members, 6K venues | Broad entertainment, half-price+ | Deal discovery | [details](goldstar.md) |
| **Fever** | Experience discovery + ticketing | 125M users, 40+ countries | Original content (Candlelight), $1.8B valuation | Curated discovery | [details](fever.md) |
| **TDF** | NYC discount theater access | 55+ year institution | TKTS booths, nonprofit mission | Mission alignment | [details](tdf.md) |

---

## Feature Gap Matrix

| Feature | TodayTix | Letterboxd | Theatregoer | Artwrld | Street Art Cities | Bandsintown | Fever | ChicagoPlays | **AoA** |
|---------|---------|-----------|------------|--------|-----------------|------------|------|-------------|--------|
| Map-based discovery | - | - | - | **YES** | **YES** | partial | - | - | **YES** |
| AI mentor/assistant | - | - | - | - | - | new | - | - | **YES** |
| Belt/progression system | - | - | - | - | - | - | - | - | **YES** |
| Social tracking (friends) | - | **YES** | partial | - | partial | - | - | - | **YES** |
| Show/event logging | - | **YES** | **YES** | - | **YES** | partial | - | - | **YES** |
| Community reviews | - | **YES** | notes | - | comments | - | - | - | **YES** |
| Watchlist | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | - | **YES** |
| Educational content | - | - | - | partial | - | - | - | - | **YES** |
| Newcomer onboarding | - | - | - | - | - | - | - | - | **YES** |
| Ticket purchasing | **YES** | - | - | - | - | **YES** | **YES** | link-out | - |
| Rush/lottery deals | **YES** | - | - | - | - | - | - | - | - |
| Walking routes | - | - | - | **YES** | **YES** | - | - | - | future |
| Stats/analytics | rewards | **YES** | **YES** | - | **YES** | - | - | - | **YES** |
| Venue profiles | - | - | partial | **YES** | **YES** | partial | partial | **YES** | **YES** |
| Theater-specific | **YES** | - | **YES** | - | - | - | partial | **YES** | **YES** |
| Chicago-specific | partial | - | - | - | - | partial | partial | **YES** | **YES** |

**Key insight from the matrix:** AoA is the only product that checks YES on map + AI + progression + social + tracking + reviews + education + onboarding. No competitor has more than 3-4 of these.

---

## Key Insights

### Patterns Across Competitors

1. **The "Letterboxd for X" opportunity is real but unexecuted for theater.** Letterboxd (30M users) and Goodreads (150M users) prove that tracking + social + reviews work for media consumption. Theatregoer proves demand exists for theater tracking (4.9/5 rating) but executes poorly (Apple-only, tiny user base, no discovery). The gap is wide open.

2. **Map-centric discovery works for culture.** Street Art Cities (65K artworks, 1,800 cities) and Artwrld ("AllTrails for art") validate that map-first is the right navigation model for geographically distributed cultural experiences. No theater product uses a map as its primary navigation.

3. **Deal platforms dominate but don't educate or build relationships.** TodayTix, HotTix, Goldstar, and Fever are all transactional — buy ticket, attend, forget. None tracks your history, none has social features, none helps newcomers learn. They serve people who already know they want to go.

4. **The newcomer is completely unserved.** Every competitor assumes the user already knows theater. ChicagoPlays assumes you know what dates you want. TodayTix assumes you know what shows exist. BroadwayWorld assumes insider knowledge. No product asks "have you ever seen a play?" and takes it from there.

5. **AI mentorship in live entertainment is brand new.** Bandsintown just added an AI assistant. Fever uses algorithmic curation. But no product has a named AI character with personality who guides you through a domain. This is AoA's most novel feature.

6. **Gamification/progression is absent from every competitor.** Not one product in this landscape has a belt/level/badge system tied to engagement depth. Letterboxd deliberately chose not to. Goodreads has a simple reading challenge. AoA's belt system is completely unique.

### Biggest Opportunities for AoA

1. **"Letterboxd for theater, but better"** — Take Letterboxd's core (log, rate, review, social) and add everything it lacks: map, AI, progression, location, newcomer pathway

2. **Chicago storefront theater is invisible** — 200+ small companies are not discoverable on any platform except ChicagoPlays' flat directory. AoA's map makes them visible

3. **Deal integration without being a deal platform** — Surface HotTix/TodayTix/Goldstar deals within AoA's recommendations ("your mentor suggests X, and it's half-price this week") without becoming a ticket seller

4. **Accessibility as differentiator** — ChicagoPlays' accessibility calendar is the only product doing this. AoA should surface ASL, audio-described, and sensory-friendly performances prominently

5. **"Theater walks" as a killer feature** — Street Art Cities and Artwrld prove that planned routes through cultural content drive engagement. "See 3 storefront theaters in Wicker Park tonight" is a feature no one offers

### Threats to Watch

1. **TodayTix Group** — They own TodayTix + Goldstar and have resources. If they add tracking/social features, they become a more complete competitor. Their MARI acquisition (Oct 2025) signals ambition.

2. **BroadwayWorld "My Shows"** — The largest theater media site adding personal tracking is significant. If they invest in this feature, their existing community could make it the default theater tracker.

3. **Fever's expansion** — $1.8B valuation, $527M funding, 40+ countries. If they decide to go deep into traditional theater (currently minor for them), their resources are formidable.

---

## Relationship to Existing Docs

- **Original landscape analysis:** `.claude/docs/landscape.md` (superseded by this research)
- **PRD:** `.claude/docs/prd/app-prd.md`
- **User Journey:** `.claude/docs/user-journey.md`
- **Domain Research:** `.claude/docs/domain-research.md`
