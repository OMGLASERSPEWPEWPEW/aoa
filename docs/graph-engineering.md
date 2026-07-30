# Graph Engineering: The Art of Art

**Date:** 2026-07-30
**Version:** 1.0

This document is the executable build specification for The Art of Art. It defines the task graph (nodes, edges, shared state) and loop specifications that Claude Code agents execute to build the app from skeleton through features.

**How to use this document:** Read Section 5 (Build Phases) to find the current phase. Read the node specs for each uncompleted node in that phase. Execute using the loop spec. Mark nodes complete and update shared state as you go.

---

## Section 1: Task Graph Topology

### Nodes

```
FOUNDATION:     scaffold, supabase-init
INFRASTRUCTURE: blueprint, harbormoon, hooks, skills
MIGRATIONS:     auth-migration, core-schema, belt-schema
CORE SHELL:     auth-ui, ai-gateway-edge, ai-gateway-client, app-shell, pwa-config
MAP:            mapbox-setup, venue-markers, venue-cards
MENTOR:         mentor-edge-fn, mentor-chat-ui
TRACKING:       watchlist-ui, show-logging, watchlist-stats
LEARNING:       learning-content-seed, learning-modals, learning-browser
BELT:           belt-engine, belt-ui, belt-unlock-animations
SOCIAL:         friendships-schema, friends-ui, activity-feed
REVIEWS:        review-schema, review-ui, community-ratings
CLASSES:        class-listings, class-markers
POLISH:         push-infrastructure, notifications-ui, onboarding-flow
```

### Edges (→ = "must complete before")

```
                    scaffold
                       │
                 supabase-init
                    /      \
        ┌──────────┘        └──────────┐
        │                              │
    blueprint                    auth-migration
        │                          /       \
    harbormoon                core-schema   auth-ui
        │                       │              │
      hooks                 belt-schema    app-shell ──────────────┐
        │                       │              │                   │
      skills              ai-gateway-edge  pwa-config        mapbox-setup
                               │                                   │
                         ai-gateway-client               venue-markers
                               │                              │
                         mentor-edge-fn                  venue-cards
                               │
                         mentor-chat-ui

    [After core shell + map + mentor complete:]

    watchlist-ui ── show-logging ── watchlist-stats
    
    learning-content-seed ── learning-modals ── learning-browser
    
    belt-engine ── belt-ui ── belt-unlock-animations
    
    friendships-schema ── friends-ui ── activity-feed
    
    review-schema ── review-ui ── community-ratings
    
    class-listings ── class-markers
    
    push-infrastructure ── notifications-ui
    
    onboarding-flow (depends on: mentor-chat-ui, mapbox-setup, watchlist-ui)
```

### ASCII DAG (parallel tracks visible)

```
Phase 0:  [scaffold] → [supabase-init]
              │
Phase 1:  [blueprint] ─→ [harbormoon] ─→ [hooks] ─→ [skills]
          [auth-migration] ─→ [core-schema] ─→ [belt-schema]
              │
Phase 2:  [auth-ui]  [ai-gateway-edge]  [mapbox-setup]
          [app-shell] [ai-gateway-client] [pwa-config]
              │              │                │
Phase 3:  [venue-markers] [mentor-edge-fn] [venue-cards]
          [mentor-chat-ui]
              │
Phase 4:  [watchlist-ui]    [learning-content-seed]  [belt-engine]
          [show-logging]    [learning-modals]         [belt-ui]
          [watchlist-stats]  [learning-browser]       [belt-unlock-animations]
              │
Phase 5:  [friendships-schema] [review-schema]  [class-listings]
          [friends-ui]         [review-ui]       [class-markers]
          [activity-feed]      [community-ratings]
              │
Phase 6:  [onboarding-flow]  [push-infrastructure]  [notifications-ui]
```

---

## Section 2: Node Specifications

### Foundation Nodes

#### Node: scaffold
- **Type**: scaffold
- **Agent**: (main context)
- **Depends on**: (none — root node)
- **Inputs**: `~/Development/patterns/blueprint/checklist.md`
- **Outputs**: Vite project at `~/Development/aoa/`, `package.json`, `vite.config.ts`, `tsconfig.json`
- **Loop pattern**: one-shot
- **Success criteria**: `npm run dev` starts without errors, shows default Vite page
- **Estimated effort**: Trivial
- **Pattern(s)**: blueprint/checklist.md §1

#### Node: supabase-init
- **Type**: config
- **Agent**: (main context)
- **Depends on**: scaffold
- **Inputs**: Supabase dashboard (manual project creation)
- **Outputs**: `supabase/` directory, `.env.local` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- **Loop pattern**: one-shot
- **Success criteria**: `supabase status` shows linked project
- **Estimated effort**: Trivial
- **Pattern(s)**: blueprint/checklist.md §3

### Infrastructure Nodes

#### Node: blueprint
- **Type**: pattern-install
- **Agent**: (main context)
- **Depends on**: supabase-init
- **Inputs**: `~/Development/patterns/blueprint/install.sh`
- **Outputs**: `.claude/rules/stack.md`, `.claude/rules/architecture.md`, `.claude/rules/anti-patterns.md`
- **Loop pattern**: one-shot
- **Success criteria**: all 3 rule files exist in `.claude/rules/`
- **Estimated effort**: Trivial
- **Pattern(s)**: blueprint/

#### Node: harbormoon
- **Type**: pattern-install
- **Agent**: (main context)
- **Depends on**: blueprint
- **Inputs**: `~/Development/patterns/harbormoon/install.sh`
- **Outputs**: `.claude/agents/` directory with division structure
- **Loop pattern**: one-shot
- **Success criteria**: `.claude/agents/divisions.json` exists
- **Estimated effort**: Trivial
- **Pattern(s)**: harbormoon/

#### Node: hooks
- **Type**: pattern-install
- **Agent**: (main context)
- **Depends on**: harbormoon
- **Inputs**: `~/Development/patterns/claudehooks/install.sh`
- **Outputs**: `.claude/hooks/` directory with hook scripts
- **Loop pattern**: one-shot
- **Success criteria**: `.claude/hooks/` contains hook scripts, `.claude/settings.json` references them
- **Estimated effort**: Trivial
- **Pattern(s)**: claudehooks/

#### Node: skills
- **Type**: pattern-install
- **Agent**: (main context)
- **Depends on**: hooks
- **Inputs**: `~/Development/patterns/claudeskills/install.sh`
- **Outputs**: `.claude/skills/` directory with skill markdown files
- **Loop pattern**: one-shot
- **Success criteria**: `.claude/skills/` contains skill directories
- **Estimated effort**: Trivial
- **Pattern(s)**: claudeskills/

### Migration Nodes

#### Node: auth-migration
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: supabase-init
- **Inputs**: `~/Development/patterns/auth/` migration files, architecture.md §4 (profiles table)
- **Outputs**: `supabase/migrations/000_profiles.sql` — profiles table extending auth.users
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `supabase db push` succeeds, profiles table exists with all columns from architecture.md §4, RLS policies active
- **Estimated effort**: Small
- **Pattern(s)**: auth/

#### Node: core-schema
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: auth-migration
- **Inputs**: architecture.md §4 (venues, events, watchlist, reviews, conversations, messages, learning_content tables)
- **Outputs**: `supabase/migrations/001_core_schema.sql`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: all tables exist with correct columns, RLS policies active, unique constraints in place
- **Estimated effort**: Medium
- **Pattern(s)**: (custom — no pattern, build from architecture.md)

#### Node: belt-schema
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: core-schema
- **Inputs**: architecture.md §4 (user_progress, friendships tables), user-journey.md (belt criteria)
- **Outputs**: `supabase/migrations/002_belt_and_social.sql`, database triggers for denormalized counters on profiles
- **Loop pattern**: plan-execute-verify
- **Success criteria**: user_progress and friendships tables exist, triggers fire on watchlist/review inserts to update profile counters
- **Estimated effort**: Medium
- **Pattern(s)**: (custom)

### Core Shell Nodes

#### Node: auth-ui
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: auth-migration
- **Inputs**: `~/Development/patterns/auth/` UI components, architecture.md §5 (component hierarchy)
- **Outputs**: `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/components/ProtectedRoute.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: can sign up new account, log in, see protected route, log out. OAuth buttons render (Google + Apple).
- **Estimated effort**: Small
- **Pattern(s)**: auth/

#### Node: ai-gateway-edge
- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: auth-migration
- **Inputs**: `~/Development/patterns/ai-gateway/supabase/functions/`, architecture.md §7
- **Outputs**: `supabase/functions/ai-gateway/index.ts`, `supabase/functions/_shared/providers/`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Edge Function deployed, `curl` with valid JWT returns AI response
- **Estimated effort**: Small
- **Pattern(s)**: ai-gateway/

#### Node: ai-gateway-client
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: ai-gateway-edge
- **Inputs**: `~/Development/patterns/ai-gateway/lib/`, architecture.md §7
- **Outputs**: `src/lib/gateway.ts`, `src/lib/models.ts`
- **Loop pattern**: one-shot
- **Success criteria**: `callModel()` callable from client, returns response
- **Estimated effort**: Trivial
- **Pattern(s)**: ai-gateway/lib/

#### Node: app-shell
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: auth-ui
- **Inputs**: architecture.md §5 (component hierarchy), §3 (routes)
- **Outputs**: `src/App.tsx`, `src/pages/AppShell.tsx`, `src/components/Header.tsx`, `src/components/Navigation.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: app loads with bottom nav (5 tabs), header with version badge, protected routes redirect to login
- **Estimated effort**: Small
- **Pattern(s)**: (custom — follows existing project conventions)

#### Node: pwa-config
- **Type**: config
- **Agent**: frontend-developer
- **Depends on**: app-shell
- **Inputs**: architecture.md §6 (PWA config), `~/Development/patterns/web-push/` for SW reference
- **Outputs**: PWA section in `vite.config.ts`, `public/` icons, offline fallback
- **Loop pattern**: one-shot
- **Success criteria**: manifest.json served at /manifest.json, service worker registers, app installable from browser
- **Estimated effort**: Small
- **Pattern(s)**: web-push/ (service worker reference only)

#### Node: mapbox-setup
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: app-shell
- **Inputs**: Mapbox GL JS docs, architecture.md §1 (Mapbox decision)
- **Outputs**: `src/components/MapView.tsx`, `src/hooks/useMap.ts`, Mapbox token in env
- **Loop pattern**: plan-execute-verify
- **Success criteria**: map renders centered on Chicago, user location dot visible, smooth pan/zoom
- **Estimated effort**: Medium
- **Pattern(s)**: (none — new dependency)

### Map Nodes

#### Node: venue-markers
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: mapbox-setup, core-schema
- **Inputs**: architecture.md §4 (venues table), §5 (VenueMarker component)
- **Outputs**: `src/components/VenueMarker.tsx`, venue data fetching hook
- **Loop pattern**: plan-execute-verify
- **Success criteria**: venue markers render on map at correct lat/lng, different icons by venue_type, tap marker triggers event
- **Estimated effort**: Medium
- **Pattern(s)**: (none)

#### Node: venue-cards
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: venue-markers
- **Inputs**: architecture.md §5 (VenueCard, VenueDetail)
- **Outputs**: `src/components/VenueCard.tsx`, `src/pages/VenueDetail.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: tapping marker shows bottom-sheet card with venue name/type/shows, tapping card navigates to full venue detail page
- **Estimated effort**: Medium
- **Pattern(s)**: (none)

### Mentor Nodes

#### Node: mentor-edge-fn
- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: ai-gateway-edge, belt-schema
- **Inputs**: architecture.md §7 (mentor-chat Edge Function), app-prd.md §3 (agent persona)
- **Outputs**: `supabase/functions/mentor-chat/index.ts` — wraps ai-gateway with user profile injection into system prompt
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Edge Function reads user profile (age, interests, belt, recent shows) and injects into Claude system prompt. Response reflects persona voice. JWT auth required.
- **Estimated effort**: Medium
- **Pattern(s)**: ai-gateway/ (underlying provider call)

#### Node: mentor-chat-ui
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: mentor-edge-fn
- **Inputs**: architecture.md §5 (MentorChat components), app-prd.md §3 (persona visual)
- **Outputs**: `src/pages/MentorChat.tsx`, `src/components/MentorAvatar.tsx`, `src/components/MessageBubble.tsx`, `src/components/SuggestedPrompts.tsx`, `src/components/ChatInput.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: user sends message → mentor responds in character with speech bubble UI → avatar visible → suggested prompts for new users → chat history persists across navigation
- **Estimated effort**: Medium
- **Pattern(s)**: (none — custom chat UI)

### Tracking Nodes

#### Node: watchlist-ui
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: app-shell, core-schema
- **Inputs**: architecture.md §4 (watchlist table), §5 (Watchlist components), app-prd.md F-5
- **Outputs**: `src/pages/Watchlist.tsx`, `src/components/WatchlistItem.tsx`, `src/components/WatchlistButton.tsx`, `src/hooks/useWatchlist.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: can add event to "want to see" from event card, watchlist page shows items with tabs (want to see / seen), can change status
- **Estimated effort**: Medium
- **Pattern(s)**: (none)
- **PRD reference**: F-5

#### Node: show-logging
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: watchlist-ui
- **Inputs**: architecture.md §4 (watchlist.rating, watchlist.reflection), app-prd.md F-6
- **Outputs**: `src/components/ReviewModal.tsx` (quick rate + reflect modal when marking "seen")
- **Loop pattern**: plan-execute-verify
- **Success criteria**: marking show as "seen" opens modal with 1-5 stars + optional reflection, data persists, profile counters update
- **Estimated effort**: Small
- **Pattern(s)**: (none)
- **PRD reference**: F-6

#### Node: watchlist-stats
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: show-logging
- **Inputs**: architecture.md §4 (profiles denormalized counters)
- **Outputs**: `src/components/WatchlistStats.tsx`
- **Loop pattern**: one-shot
- **Success criteria**: stats display shows total shows seen, venues visited, genres explored
- **Estimated effort**: Trivial
- **Pattern(s)**: (none)

### Learning Nodes

#### Node: learning-content-seed
- **Type**: migration
- **Agent**: (main context)
- **Depends on**: core-schema
- **Inputs**: docs/convo-one.md (venue descriptions, playwright info, genre explainers), app-prd.md §11
- **Outputs**: `supabase/seed/learning_content.sql` — 20-30 initial learning modules
- **Loop pattern**: one-shot
- **Success criteria**: learning_content table populated with seed data covering venues, playwrights, genres, how-to guides
- **Estimated effort**: Medium
- **Pattern(s)**: (none)
- **PRD reference**: F-7

#### Node: learning-modals
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: learning-content-seed
- **Inputs**: architecture.md §5 (LearningModal), app-prd.md F-7
- **Outputs**: `src/components/LearningModal.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: tapping learning icon on map or in mentor chat opens card-based modal with content, swipeable, respects belt requirement
- **Estimated effort**: Small
- **Pattern(s)**: (none)
- **PRD reference**: F-7

#### Node: learning-browser
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: learning-modals
- **Inputs**: architecture.md §5 (Learn page)
- **Outputs**: `src/pages/Learn.tsx`, `src/pages/LearningModule.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: learn tab shows grid of available modules filtered by belt, tapping opens full content, completed modules tracked in user_progress
- **Estimated effort**: Small
- **Pattern(s)**: (none)

### Belt Nodes

#### Node: belt-engine
- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: belt-schema, watchlist-ui
- **Inputs**: user-journey.md (belt criteria table), architecture.md §7 (belt-check Edge Function)
- **Outputs**: `supabase/functions/belt-check/index.ts` — evaluates user_progress against belt criteria, advances belt
- **Loop pattern**: plan-execute-verify
- **Success criteria**: after logging a show, belt-check evaluates criteria. If met, profiles.belt_level increments, belt_history updated. Server-authoritative (not client-side).
- **Estimated effort**: Medium
- **Pattern(s)**: (none)
- **PRD reference**: F-11

#### Node: belt-ui
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: belt-engine
- **Inputs**: architecture.md §5 (BeltDisplay, BeltProgress), user-journey.md (belt names/colors)
- **Outputs**: `src/components/BeltDisplay.tsx`, `src/components/BeltProgress.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: profile page shows current belt with color, progress bar toward next belt with criteria checklist
- **Estimated effort**: Small
- **Pattern(s)**: (none)

#### Node: belt-unlock-animations
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: belt-ui
- **Inputs**: architecture.md §5 (BeltUpgradeModal)
- **Outputs**: `src/components/BeltUpgradeModal.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: when belt advances, celebratory modal appears with new belt color, name, and list of unlocked features
- **Estimated effort**: Small
- **Pattern(s)**: (none)

### Social Nodes

#### Node: friendships-schema
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: belt-schema
- **Inputs**: architecture.md §4 (friendships table)
- **Outputs**: `supabase/migrations/003_friendships_rls.sql` (RLS policies for friend-scoped watchlist reads)
- **Loop pattern**: one-shot
- **Success criteria**: friendships table RLS allows reading friend's watchlist entries
- **Estimated effort**: Small
- **Pattern(s)**: (none)
- **PRD reference**: F-12

#### Node: friends-ui
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: friendships-schema
- **Inputs**: architecture.md §5 (Social components), app-prd.md F-12
- **Outputs**: `src/pages/Social.tsx`, `src/components/FriendsList.tsx`, `src/components/AddFriend.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: can send friend request, accept/decline, see friends list, see friend's watchlist
- **Estimated effort**: Medium
- **Pattern(s)**: (none)

#### Node: activity-feed
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: friends-ui
- **Inputs**: architecture.md §5 (ActivityFeed)
- **Outputs**: `src/components/ActivityFeed.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: social tab shows chronological feed of friends' activity (saw X, added Y, earned Z belt)
- **Estimated effort**: Medium
- **Pattern(s)**: (none — consider Supabase Realtime for live updates)

### Review Nodes

#### Node: review-schema
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: core-schema
- **Inputs**: architecture.md §4 (reviews table)
- **Outputs**: `supabase/migrations/004_reviews_triggers.sql` — triggers to update events.community_rating and events.rating_count
- **Loop pattern**: one-shot
- **Success criteria**: review insert triggers recalculate community_rating on events table
- **Estimated effort**: Small
- **Pattern(s)**: (none)
- **PRD reference**: F-13

#### Node: review-ui
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: review-schema, show-logging
- **Inputs**: architecture.md §5 (ReviewsList), app-prd.md F-13
- **Outputs**: `src/components/ReviewForm.tsx`, `src/components/ReviewsList.tsx`, `src/components/ReviewCard.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: can write full review (title, body, rating, spoiler toggle), reviews display on event detail page, helpful voting works
- **Estimated effort**: Medium
- **Pattern(s)**: (none)

#### Node: community-ratings
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: review-ui
- **Inputs**: architecture.md §4 (events.community_rating)
- **Outputs**: `src/components/CommunityRating.tsx`
- **Loop pattern**: one-shot
- **Success criteria**: aggregate star rating with count visible on event cards and detail pages
- **Estimated effort**: Trivial
- **Pattern(s)**: (none)

### Class Nodes

#### Node: class-listings
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: core-schema, venue-cards
- **Inputs**: architecture.md §4 (events where event_type = 'class'), app-prd.md F-15
- **Outputs**: event_type filter for classes, class-specific card styling
- **Loop pattern**: plan-execute-verify
- **Success criteria**: classes appear as distinct marker type on map, class detail shows schedule/level/price, "interested" tracking
- **Estimated effort**: Small
- **Pattern(s)**: (none)
- **PRD reference**: F-15

#### Node: class-markers
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: class-listings
- **Inputs**: mapbox-setup (marker system)
- **Outputs**: class-specific map marker icons
- **Loop pattern**: one-shot
- **Success criteria**: class markers visually distinct from theater markers on map
- **Estimated effort**: Trivial
- **Pattern(s)**: (none)

### Polish Nodes

#### Node: push-infrastructure
- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: pwa-config
- **Inputs**: `~/Development/patterns/web-push/`
- **Outputs**: push subscription management, service worker push handler
- **Loop pattern**: plan-execute-verify
- **Success criteria**: user can grant notification permission, subscription stored in DB, test push received on device
- **Estimated effort**: Medium
- **Pattern(s)**: web-push/
- **PRD reference**: F-16

#### Node: notifications-ui
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: push-infrastructure
- **Inputs**: app-prd.md F-16 (notification categories)
- **Outputs**: notification preferences in settings, notification triggers (show reminders, belt advancement, friend activity)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: user receives push for upcoming watchlisted show, can toggle notification categories in settings
- **Estimated effort**: Medium
- **Pattern(s)**: web-push/

#### Node: onboarding-flow
- **Type**: feature
- **Agent**: frontend-developer, ui-designer
- **Depends on**: mentor-chat-ui, mapbox-setup, watchlist-ui
- **Inputs**: app-prd.md F-8, user-journey.md §Level 0, architecture.md §3 (/onboarding route)
- **Outputs**: `src/pages/Onboarding.tsx` — multi-step flow: age → city → experience → interests → mentor intro → first recommendation
- **Loop pattern**: plan-execute-verify
- **Success criteria**: new user completes onboarding in < 2 minutes, profile populated, mentor gives first personalized recommendation, map zooms to recommended venue
- **Estimated effort**: Medium
- **Pattern(s)**: (none)
- **PRD reference**: F-8

---

## Section 3: Loop Specifications

### Loop: auth-ui
- **Trigger**: auth-migration complete
- **Inner cycle**:
  1. Discover: read auth/ pattern components, identify files to copy
  2. Plan: map pattern files to project paths, identify brand customizations
  3. Execute: copy and adapt components, wire AuthProvider into App.tsx
  4. Verify: sign up new account → log in → see protected route → log out
- **Evaluator**: all 4 auth actions succeed without errors
- **Retry**: on failure → read console errors → fix → re-verify (max 3 cycles)
- **Stop condition**: signup, login, protected access, and logout all work

### Loop: mapbox-setup
- **Trigger**: app-shell complete
- **Inner cycle**:
  1. Discover: read Mapbox GL JS docs, check npm package
  2. Plan: MapView component structure, token management, initial viewport (Chicago center)
  3. Execute: install mapbox-gl, create MapView.tsx, add token to env
  4. Verify: map renders centered on Chicago (41.8781, -87.6298), pan/zoom smooth, user location dot visible
- **Evaluator**: map visible in browser, no console errors, smooth interaction
- **Retry**: on failure → check token, CORS, CSS import → fix → re-verify (max 3 cycles)
- **Stop condition**: map renders and is interactive

### Loop: mentor-edge-fn
- **Trigger**: ai-gateway-edge and belt-schema complete
- **Inner cycle**:
  1. Discover: read ai-gateway Edge Function, read persona spec in app-prd.md §3
  2. Plan: system prompt template with user profile injection slots, conversation history management
  3. Execute: create mentor-chat Edge Function that reads user profile and injects into Claude system prompt
  4. Verify: curl with JWT → response reflects persona voice, knows user's age/interests
- **Evaluator**: response is in-character, references user context, JWT required
- **Retry**: on failure → check system prompt, profile query, JWT validation → fix (max 3 cycles)
- **Stop condition**: mentor responds in character with user-aware context

### Loop: mentor-chat-ui
- **Trigger**: mentor-edge-fn complete
- **Inner cycle**:
  1. Discover: review chat UI patterns from existing projects (Nib's Claude chat modal)
  2. Plan: component tree (MentorChat → Avatar + MessageBubble + SuggestedPrompts + ChatInput)
  3. Execute: build chat page with speech bubble styling, avatar, suggested prompts for new users
  4. Verify: send message → see user bubble → see mentor response bubble → avatar visible → suggested prompts clickable → chat history persists
- **Evaluator**: full send-receive cycle works, UI matches speech bubble design, history persists
- **Retry**: on failure → check streaming, bubble styling, state management → fix (max 3 cycles)
- **Stop condition**: chat fully functional with persona-appropriate UI

### Loop: venue-markers
- **Trigger**: mapbox-setup and core-schema complete
- **Inner cycle**:
  1. Discover: read Mapbox custom marker docs, venue data from Supabase
  2. Plan: marker component, data fetching hook, icon design per venue_type
  3. Execute: fetch venues, render markers at lat/lng with type-specific icons
  4. Verify: markers render at correct positions, icons differ by type, tap fires event
- **Evaluator**: markers visible on map, clustered appropriately, tap triggers venue card
- **Retry**: on failure → check data fetch, marker positioning, event handling → fix (max 3 cycles)
- **Stop condition**: all seed venues visible with correct icons

### Loop: watchlist-ui
- **Trigger**: app-shell and core-schema complete
- **Inner cycle**:
  1. Discover: read Letterboxd/Theatregoer UI patterns for reference
  2. Plan: watchlist hook (add/remove/update status), UI components (tabs, items, button)
  3. Execute: build WatchlistButton (appears on event cards), Watchlist page with tabs
  4. Verify: add event from card → appears in "want to see" tab → change to "seen" → moves to "seen" tab
- **Evaluator**: full CRUD cycle works, tab filtering correct, optimistic updates
- **Retry**: on failure → check RLS, state management, optimistic update → fix (max 3 cycles)
- **Stop condition**: watchlist fully functional with three states

### Loop: belt-engine
- **Trigger**: belt-schema and watchlist-ui complete
- **Inner cycle**:
  1. Discover: read user-journey.md belt criteria table, understand all triggers
  2. Plan: Edge Function that reads user_progress, evaluates against belt criteria, advances if met
  3. Execute: create belt-check Edge Function, wire to trigger after watchlist/review/progress updates
  4. Verify: log a show → belt-check runs → if criteria met, belt advances → profile reflects new belt
- **Evaluator**: belt advances correctly when criteria met, does not advance when not met
- **Retry**: on failure → check criteria evaluation logic, trigger timing → fix (max 3 cycles)
- **Stop condition**: belt advancement is server-authoritative and correct for all belt levels

### Loop: onboarding-flow
- **Trigger**: mentor-chat-ui, mapbox-setup, and watchlist-ui complete
- **Inner cycle**:
  1. Discover: read user-journey.md §Level 0, review existing onboarding patterns
  2. Plan: multi-step flow (age → city → experience → interests → mentor intro → first rec), < 2 min target
  3. Execute: build Onboarding page with step progression, mentor character introduction, first recommendation with map zoom
  4. Verify: new user signup → onboarding flow → completes in < 2 min → profile populated → mentor recommends show → map zooms to venue
- **Evaluator**: full flow completes, profile data correct, recommendation generated, map responds
- **Retry**: on failure → check step transitions, profile saving, mentor API call → fix (max 3 cycles)
- **Stop condition**: onboarding flow smooth and complete

---

## Section 4: Shared State Schema

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| project_path | string | scaffold | all nodes |
| port | number | scaffold | app-shell, all verify steps |
| supabase_ref | string | supabase-init | all migration nodes, edge functions |
| supabase_url | string | supabase-init | ai-gateway-client, all frontend data fetching |
| supabase_anon_key | string | supabase-init | ai-gateway-client, all frontend data fetching |
| mapbox_token | string | mapbox-setup | venue-markers, class-markers |
| installed_patterns | string[] | blueprint, harbormoon, hooks, skills, auth, ai-gateway, web-push | feature nodes (know what's available) |
| migration_files | string[] | auth-migration, core-schema, belt-schema, friendships-schema, review-schema | verification, rollback |
| edge_functions | string[] | ai-gateway-edge, mentor-edge-fn, belt-engine, push-infrastructure | frontend nodes (know what APIs exist) |
| verified_nodes | string[] | all verify steps | progress tracking, phase advancement |
| seed_data_loaded | boolean | learning-content-seed | learning-modals, learning-browser |

---

## Section 5: Build Phases (Topological Sort)

Nodes within a phase can run in parallel (fan out via Claude Code subagents). All nodes in a phase must pass verification before advancing.

### Phase 0: Foundation
- [ ] scaffold
- [ ] supabase-init

### Phase 1: Infrastructure (two parallel tracks)
**Track A (patterns):**
- [ ] blueprint → harbormoon → hooks → skills

**Track B (database):**
- [ ] auth-migration → core-schema → belt-schema

### Phase 2: Core Shell (parallel after Phase 1)
- [ ] auth-ui
- [ ] ai-gateway-edge → ai-gateway-client
- [ ] app-shell → pwa-config
- [ ] mapbox-setup

### Phase 3: Map + Mentor (parallel tracks)
**Track A (map):**
- [ ] venue-markers → venue-cards

**Track B (mentor):**
- [ ] mentor-edge-fn → mentor-chat-ui

### Phase 4: Core Features (three parallel tracks)
**Track A (tracking):**
- [ ] watchlist-ui → show-logging → watchlist-stats

**Track B (learning):**
- [ ] learning-content-seed → learning-modals → learning-browser

**Track C (belts):**
- [ ] belt-engine → belt-ui → belt-unlock-animations

### Phase 5: Social + Reviews (three parallel tracks)
**Track A (social):**
- [ ] friendships-schema → friends-ui → activity-feed

**Track B (reviews):**
- [ ] review-schema → review-ui → community-ratings

**Track C (classes):**
- [ ] class-listings → class-markers

### Phase 6: Polish
- [ ] onboarding-flow
- [ ] push-infrastructure → notifications-ui

### Phase 7: Launch Readiness
- [ ] CLAUDE.md complete
- [ ] Seed data for Chicago venues (50-100)
- [ ] Seed data for current Chicago events
- [ ] First deploy to Vercel
- [ ] Smoke test: full user journey (signup → onboard → see show → rate → earn belt)
