# ADR 0004: Play-Level Interest as a First-Class Primitive

**Date:** 2026-08-13
**Status:** Proposed
**Feature:** Play Page — Frames 4a and 4b (PRD: `.claude/docs/prd/play-page.md`)

## Context

The existing `watchlist` table is keyed on `event_id`. A user can want a *production* — a specific run at a specific venue — but cannot want a *play* (the work) when no company is currently staging it. For most plays in the database the production list is empty. The page is dead.

Theater's defining property is that the work is not continuously available. A user who wants to see *Marisol* but cannot find a current Chicago production has no way to express that want, track it, or be notified when someone announces a staging. This is the core structural problem.

Three options were considered for adding play-level interest.

## Decision

Introduce a dedicated `play_interest` table with `(user_id, play_id, city)` — a want keyed to the work, scoped to a city, that persists indefinitely and is independent of any production.

## Alternatives Considered

**Option A: Extend `watchlist` with a nullable `event_id`**

Allow `watchlist` rows where `event_id` IS NULL and `play_id` is non-null. This reuses the existing table and hook.

Rejected because:
- The watchlist schema assumes `event_id` in multiple places (triggers, RLS, UI components, the hook's return shape). Nullable event_id creates a split-brain type that would require conditional logic throughout `useWatchlist`, `MyShows`, and every trigger
- The three shelf statuses (`want_to_see`, `booked`, `seen`) have no meaning for a play-level want — a play cannot be "booked"
- The `event_emotion_counts` trigger fires on watchlist writes and resolves `event_id` unconditionally; a null event_id would require a guard

**Option B: Add a `play_wishlist` boolean column on `profiles`**

Store a `text[]` of play IDs on the profile row.

Rejected because:
- Arrays on profile rows do not support city-scoped counts or time-series trend queries without full table scans
- No per-row `created_at` makes trend data impossible
- Arrays cannot be indexed for efficient `play_id`-scoped fan-out (notification delivery)
- Does not scale beyond a few dozen entries per user

**Option C (chosen): Dedicated `play_interest` table**

Separate table with `(user_id, play_id, city, created_at)`. RLS restricts row access to the owning user. Aggregate counts exposed via `play_waiting_counts` view (no user IDs exposed to non-friends). City stamped at insert from `profiles.home_city`.

## Consequences

**Positive:**
- Clean type separation: `watchlist` = production-level, `play_interest` = work-level. No ambiguity.
- City-scoped aggregate counts via view, not table scan
- `created_at` enables the 8-bar monthly trend without additional data
- Fan-out index on `(play_id, city)` supports notification delivery at scale
- Emotion aggregate table (`play_emotion_counts`) follows the same trigger pattern as the existing `event_emotion_counts` and `profile_emotion_counts` — no new patterns introduced

**Negative:**
- `usePlayInterest` is a new hook (duplicate of some `useWatchlist` plumbing). Acceptable: the shapes are different enough that extending `useWatchlist` would increase complexity more than a new hook.
- Migration adds 4 new SQL objects (1 table, 2 views, 1 aggregate table). All are additive; no existing tables are altered except `plays` (new nullable columns).

**Neutral:**
- The `plays` table gains 4 nullable columns (`premise`, `read_prompt`, `library_url`, `adjacent_event_id`). These can be backfilled editorially over time; the UI handles null values gracefully in all cases.
- Notification delivery (fan-out when an event is created for a waited-for play) is explicitly deferred to a separate feature. The `play_interest` table is ready to support it via the `(play_id, city)` index.
