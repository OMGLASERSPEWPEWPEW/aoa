# Architecture: The Art of Art

**Date:** 2026-07-30

---

## 1. Stack

Standard stack from `~/Development/patterns/blueprint/`:

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Routing | React Router v7 |
| Local storage | Dexie v4 (IndexedDB) |
| Backend | Supabase (Auth + Postgres + Edge Functions + Realtime) |
| AI | AI Gateway pattern → Claude (primary) |
| Auth | Auth pattern → Google OAuth + Apple OAuth + email/password |
| PWA | vite-plugin-pwa + Workbox |
| Maps | Mapbox GL JS (free tier: 50K loads/month, sufficient for launch) |
| Hosting | Vercel (static only — NO serverless functions) |

## 2. Pattern Selection

### Core Patterns (every project)

| Pattern | Path | Purpose |
|---------|------|---------|
| blueprint | `~/Development/patterns/blueprint/` | Architecture norms, .claude/rules/ |
| harbormoon | `~/Development/patterns/harbormoon/` | Agent crew |
| claudehooks | `~/Development/patterns/claudehooks/` | Lifecycle hooks |
| claudeskills | `~/Development/patterns/claudeskills/` | Skill prompts |

### Code Patterns

| Pattern | Path | Purpose | Customization |
|---------|------|---------|---------------|
| auth | `~/Development/patterns/auth/` | Login, signup, OAuth, protected routes | Brand colors, OAuth providers (Google + Apple) |
| ai-gateway | `~/Development/patterns/ai-gateway/` | Multi-provider AI via Edge Function | Mentor persona in system prompt, Claude as primary model |
| web-push | `~/Development/patterns/web-push/` | Push notifications (P2, infrastructure in skeleton) | Notification categories for shows, friends, belts |
| diagnostics | `~/Development/patterns/diagnostics/` | Browser telemetry | Standard config |
| project-sota | `~/Development/patterns/project-sota/` | TODO tracking | Standard |

### Not Needed (MVP)

| Pattern | Why Not |
|---------|---------|
| stripe | No monetization in Phase 1 |
| bridge | Can add post-MVP if needed |
| kb | Overkill for single-app knowledge |

## 3. Route Structure

```
/                       → Landing (public — map preview + CTA)
/login                  → Login (auth pattern)
/signup                 → Signup (auth pattern)
/onboarding             → Onboarding flow (age, city, interests)
/app                    → AppShell (protected) — map home
/app/venue/:id          → Venue detail
/app/event/:id          → Event detail
/app/watchlist          → Watchlist (want to see / seen)
/app/mentor             → Full-screen mentor chat
/app/learn              → Learning content browser
/app/learn/:id          → Learning module detail
/app/social             → Friends + activity feed
/app/profile            → User profile + belt display + stats
/app/settings           → Settings (notifications, account, city)
```

## 4. Data Models

### profiles
Extends Supabase auth.users.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK, FK → auth.users) | |
| username | text (unique) | Display name |
| age_range | text | '20s' / '30s' / '40s' / '50s+' |
| home_city | text | 'chicago' for launch |
| experience_level | text | 'never' / 'few' / 'regular' / 'professional' |
| interests | text[] | Array of genre tags |
| belt_level | int (default 0) | 0=white through 7=black |
| shows_seen_count | int (default 0) | Denormalized counter |
| venues_visited_count | int (default 0) | Denormalized counter |
| reviews_written_count | int (default 0) | Denormalized counter |
| onboarding_complete | boolean (default false) | |
| avatar_url | text | Profile photo |
| created_at | timestamptz | |

**RLS:** Users can read any profile. Users can update only their own.

### venues

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | |
| slug | text (unique) | URL-safe name |
| description | text | |
| venue_type | text | 'storefront' / 'institutional' / 'experimental' / 'school' |
| address | text | |
| neighborhood | text | |
| city | text | 'chicago' |
| latitude | float8 | |
| longitude | float8 | |
| price_range | text | '$' / '$$' / '$$$' |
| website_url | text | |
| photo_url | text | |
| genre_tags | text[] | |
| accessibility_info | text | |
| created_at | timestamptz | |

**RLS:** Anyone can read. Only service role can write (admin/seed data).

### events

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| venue_id | uuid (FK → venues) | |
| title | text | |
| slug | text (unique) | |
| description | text | |
| event_type | text | 'show' / 'class' / 'workshop' / 'festival' / 'open-call' |
| genre_tags | text[] | |
| start_date | date | |
| end_date | date | nullable for one-off events |
| show_times | jsonb | Array of { day, time } |
| price_min | int | In cents |
| price_max | int | In cents |
| ticket_url | text | |
| hottix_available | boolean | |
| photo_url | text | |
| community_rating | float4 | Denormalized avg, nullable |
| rating_count | int (default 0) | |
| created_at | timestamptz | |

**RLS:** Anyone can read. Only service role can write.

### watchlist

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → profiles) | |
| event_id | uuid (FK → events) | |
| status | text | 'want_to_see' / 'seeing' / 'seen' |
| rating | int | 1-5, nullable (set when status = 'seen') |
| reflection | text | Quick one-liner, nullable |
| seen_date | date | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**RLS:** Users can CRUD their own. Users can read friends' entries (via friendships table).
**Unique constraint:** (user_id, event_id)

### reviews

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → profiles) | |
| event_id | uuid (FK → events) | |
| rating | int | 1-5 |
| title | text | |
| body | text | |
| contains_spoilers | boolean (default false) | |
| helpful_count | int (default 0) | |
| created_at | timestamptz | |

**RLS:** Anyone can read. Users can create/update/delete their own.
**Unique constraint:** (user_id, event_id)

### friendships

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| requester_id | uuid (FK → profiles) | |
| addressee_id | uuid (FK → profiles) | |
| status | text | 'pending' / 'accepted' / 'declined' |
| created_at | timestamptz | |

**RLS:** Users can read/update rows where they are requester or addressee.
**Unique constraint:** (requester_id, addressee_id)

### conversations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → profiles) | |
| title | text | Auto-generated summary |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**RLS:** Users can CRUD their own only.

### messages

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| conversation_id | uuid (FK → conversations) | |
| role | text | 'user' / 'assistant' |
| content | text | |
| created_at | timestamptz | |

**RLS:** Users can CRUD messages in their own conversations.

### user_progress

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → profiles, unique) | |
| genres_explored | text[] | Distinct genres from seen shows |
| venues_visited | uuid[] | Distinct venue IDs |
| learning_modules_completed | text[] | Module slugs |
| friends_invited | int (default 0) | |
| opening_nights_attended | int (default 0) | |
| ushering_count | int (default 0) | |
| belt_history | jsonb | Array of { belt, earned_at } |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**RLS:** Users can read/update their own only.

### learning_content

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| slug | text (unique) | |
| title | text | |
| body | text | Markdown content |
| category | text | 'venue' / 'playwright' / 'genre' / 'guide' / 'history' |
| belt_requirement | int (default 0) | Minimum belt to access |
| related_venue_ids | uuid[] | Venues this content references |
| photo_url | text | |
| created_at | timestamptz | |

**RLS:** Anyone can read (filtered by belt level in app logic).

## 5. Component Hierarchy

```
App
├── AuthProvider (from auth/ pattern)
├── Router
│   ├── PublicRoutes
│   │   ├── Landing (map preview + "Get Started")
│   │   ├── Login
│   │   └── Signup
│   ├── OnboardingRoute (protected, pre-onboarding-complete)
│   │   └── Onboarding (age → city → experience → interests → first rec)
│   └── ProtectedRoutes (post-onboarding)
│       └── AppShell
│           ├── MapHome
│           │   ├── MapView (Mapbox GL)
│           │   │   ├── VenueMarker (per venue)
│           │   │   ├── EventMarker (for featured events)
│           │   │   └── UserLocationDot
│           │   ├── VenueCard (bottom sheet on marker tap)
│           │   └── MentorFloatingButton
│           ├── VenueDetail
│           │   ├── VenueHeader (photo, name, type)
│           │   ├── VenueInfo (address, price, accessibility)
│           │   ├── CurrentShows (event list)
│           │   └── LearningLink (if learning content exists for venue)
│           ├── EventDetail
│           │   ├── EventHeader (title, dates, venue)
│           │   ├── EventInfo (price, genre, times)
│           │   ├── WatchlistButton ("Want to See" / "Seen")
│           │   ├── CommunityRating
│           │   └── ReviewsList
│           ├── Watchlist
│           │   ├── WatchlistTabs (Want to See / Seen)
│           │   ├── WatchlistItem (event card + status)
│           │   └── WatchlistStats (count, genres, venues)
│           ├── MentorChat
│           │   ├── MentorAvatar
│           │   ├── MessageBubble (user + assistant)
│           │   ├── SuggestedPrompts
│           │   └── ChatInput
│           ├── Learn
│           │   ├── LearningGrid (cards by category)
│           │   └── LearningModule (full content view)
│           ├── Social
│           │   ├── FriendsList
│           │   ├── ActivityFeed
│           │   └── AddFriend
│           ├── Profile
│           │   ├── BeltDisplay
│           │   ├── Stats (shows, venues, reviews)
│           │   ├── BeltProgress (next belt criteria)
│           │   └── ReviewHistory
│           └── Settings
├── Navigation (bottom tab bar — mobile)
│   ├── MapTab
│   ├── WatchlistTab
│   ├── MentorTab
│   ├── LearnTab
│   └── ProfileTab
└── Toasts / Modals
    ├── BeltUpgradeModal (animation + unlocks list)
    ├── LearningModal (triggered from map or mentor)
    └── ReviewModal (rate + reflect after "seen")
```

## 6. PWA Configuration

| Setting | Value |
|---------|-------|
| App name | The Art of Art |
| Short name | Art of Art |
| Theme color | TBD (warm, inviting — not corporate blue) |
| Background color | TBD |
| Display | standalone |
| Start URL | /app |
| Icons | 192x192, 512x512, maskable |
| Offline strategy | Cache-first for static + venue data. Network-first for events, reviews, chat. |

## 7. Edge Functions

| Function | Purpose | Pattern |
|----------|---------|---------|
| `ai-gateway` | Mentor chat (Claude with persona system prompt + user context) | ai-gateway/ |
| `mentor-chat` | Wraps ai-gateway with user profile, belt, history injection into system prompt | Custom on top of ai-gateway/ |
| `belt-check` | Evaluates user progress against belt criteria, advances belt if earned | Custom |

## 8. Key Technical Decisions

1. **Mapbox GL JS over Google Maps**: Free tier is generous (50K loads/month), better customization for marker styling, no API key exposure issues (Mapbox tokens are restricted by URL).

2. **Denormalized counters on profiles**: `shows_seen_count`, `venues_visited_count`, `reviews_written_count` — updated via triggers on watchlist/reviews inserts. Avoids expensive COUNT queries for belt calculations.

3. **Belt evaluation as Edge Function**: Not client-side. Server-authoritative belt advancement prevents gaming. Triggered after watchlist status change, review creation, etc.

4. **Mentor system prompt injection**: The Edge Function reads user profile (age, interests, belt, recent shows) and injects it into the Claude system prompt on every chat call. The mentor "knows" the user without maintaining conversation context beyond the current session.

5. **Dexie for offline venue data**: Venue and learning content cached in IndexedDB for offline map browsing. Watchlist accessible offline. Chat requires network.
