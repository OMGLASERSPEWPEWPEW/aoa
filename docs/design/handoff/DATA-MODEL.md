# DATA-MODEL.md — schema deltas

Against `OMGLASERSPEWPEWPEW/aoa` @ `main`, migrations through `20260731000005_expand_venues.sql`, and the types in `src/lib/types.ts`.

All tables keep RLS. All new user-owned rows follow the existing policy shape (`auth.uid() = user_id` for write, public read where the current tables are publicly readable).

---

## 1. `profiles` — belts out, House in

```sql
alter table profiles add column house_rank smallint not null default 0
  check (house_rank between 0 and 6);
update profiles set house_rank = least(belt_level, 6);
alter table profiles drop column belt_level;

alter table profiles add column ushered_count int not null default 0;
update profiles p set ushered_count = coalesce(
  (select ushering_count from user_progress up where up.user_id = p.id), 0);
```

`ushered_count` is promoted onto `profiles` so the profile header and the review badge read from one row. Keep `user_progress.ushering_count` as the source of truth and sync it with the existing counter-trigger pattern.

Retire the trigger that computed `belt_level`; replace with `check_house_rank(user_id)` implementing the table in `THE-HOUSE.md`. It must be idempotent, must never lower a rank, and must return the new rank (or null) so the client can show the rank-up moment exactly once.

---

## 2. `watchlist` — three shelves, no rating

```sql
-- shelf rename
alter table watchlist drop constraint watchlist_status_check;
update watchlist set status = 'booked' where status = 'seeing';
alter table watchlist add constraint watchlist_status_check
  check (status in ('want_to_see','booked','seen'));

-- feelings replace stars
alter table watchlist add column emotions text[] not null default '{}';
alter table watchlist add column room_volume text
  check (room_volume in ('murmur','applause','standing'));
alter table watchlist add constraint watchlist_emotions_len
  check (cardinality(emotions) <= 3);
alter table watchlist drop column rating;

-- booking details (Tickets Booked shelf)
alter table watchlist add column performance_at timestamptz;
alter table watchlist add column seat_note text;      -- 'ROW J, SEAT 12'
```

`reflection` stays as-is (the short text captured at log time). `seen_date` stays.

`emotions` is an ordered array of slugs from `EMOTIONS.md`. **Order is data, not presentation** — never sort it on read.

Validate slugs with a trigger or a `emotion_slugs` lookup table with an FK-ish check; do not trust the client.

---

## 3. `reviews` — feelings replace stars

```sql
alter table reviews add column emotions text[] not null default '{}';
alter table reviews add column prompt text;   -- 'surprised' | 'image' | 'who' | null
alter table reviews add constraint reviews_emotions_len
  check (cardinality(emotions) between 1 and 3);
alter table reviews drop column rating;
```

`contains_spoilers`, `helpful_count`, `title`, `body` all stay.

A review's `emotions` default to the ones chosen in the log step; the user can edit them from step 2. If the user edits, update **both** the review and the parent watchlist row — they must not diverge.

---

## 4. New: `plays` — the work, distinct from the production

Theater's core difference from books. The same play exists in many productions; a person tracks productions but discovers plays.

```sql
create table plays (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  playwright text not null,
  year_written int,
  awards text[] not null default '{}',   -- 'Pulitzer, 2002'
  synopsis text,
  created_at timestamptz not null default now()
);

alter table events add column play_id uuid references plays(id);
create index on events (play_id);
```

Drives:
- Show detail's `THE PLAY: … · 3 productions tracked →` line
- Discover's "The play, not the poster" card
- The insight that a user has *seen this play before, elsewhere* — surface it on the show detail as `YOU SAW THIS AT COURT IN 2019`

Not every event has a `play_id` (improv, devised work, festivals). Handle null everywhere.

---

## 5. New: venue access fields — the product promise

```sql
alter table venues add column pay_what_you_can_days text[] not null default '{}';
alter table venues add column student_rush_price numeric;
alter table venues add column seat_count int;
alter table venues add column usher_signup_url text;

create table event_access (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  asl_dates date[] not null default '{}',
  relaxed_dates date[] not null default '{}',
  audio_described_dates date[] not null default '{}',
  open_caption_dates date[] not null default '{}',
  touch_tour_dates date[] not null default '{}',
  usher_slots int not null default 0,
  runtime_minutes int,
  has_intermission boolean,
  content_notes text,
  created_at timestamptz not null default now()
);
create unique index on event_access (event_id);
```

These fields drive every green chip in the UI and the `USHER SLOTS` map filter. **They are the highest-value data in the schema for this product** — AOA exists to make theater enterable, and price, free nights, and access services are what decide whether a newcomer goes. Treat blank access data as a content bug, not an empty state.

`events.price_min` / `price_max` / `hottix_available` already exist — keep them and surface them on every card.

---

## 6. New: emotion aggregates

The spectrum bar appears on every card in a scrolling feed. It must never be computed client-side across all cards.

```sql
create table event_emotion_counts (
  event_id uuid not null references events(id) on delete cascade,
  emotion text not null,
  weight numeric not null default 0,   -- share-of-picks, see below
  primary key (event_id, emotion)
);
```

Maintenance: a trigger on `watchlist` (insert/update of `emotions`) and on `reviews`. A person who picks three feelings contributes `1/3` to each, so percentages sum to 100 across the event.

```sql
create view event_spectrum as
select event_id,
       emotion,
       round(100 * weight / nullif(sum(weight) over (partition by event_id), 0)) as pct
from event_emotion_counts;
```

Also maintain `profile_emotion_counts(user_id, emotion, weight, season)` the same way — it backs the personal palette on My Shows (all-time) and the profile (this season). Season = Sept 1 → Aug 31.

Search-by-feeling reads `event_spectrum` ordered by `pct desc` with a `pct >= 25` floor.

---

## 7. Tonight

"Curtain up tonight" is a computed thing, not a column. `events.show_times` is already `jsonb`; formalise it:

```json
{ "mon": [], "tue": ["19:30"], "wed": ["19:30"], "thu": ["19:30"],
  "fri": ["20:00"], "sat": ["15:00","20:00"], "sun": ["14:00"],
  "exceptions": { "2026-07-04": [] } }
```

```sql
create function is_up_tonight(e events, at timestamptz default now())
returns boolean language sql stable as $$ ... $$;
```

Used by: the Tonight marquee counts, the map's live dots and `TONIGHT` filter, and the map sheet's `ON STAGE TONIGHT, 7:30` / `DARK TONIGHT` line. Compute server-side in the venue/event query — the client must never scan the whole table.

---

## 8. Friend activity

`friendships` already exists (`requester_id`, `addressee_id`, `status`). The Tonight feed's "Your people went out" reads accepted friendships joined to their `watchlist` rows with `status='seen'` in the last 14 days, ordered by `seen_date desc`, limit 1 on Tonight and paginated on a full activity view.

Show the friend's `emotions` and the first ~90 characters of `reflection`. Respect a per-user `share_reflections boolean default true` on `profiles` — a person must be able to keep a private record.

---

## 9. Offline

Dexie v4 is already in the stack. Queue **log-a-show** writes offline and retry on reconnect. Losing somebody's reflection about a show they will never see again is the worst failure mode this app has. Everything else can require the network.

---

## 10. TypeScript types to update — `src/lib/types.ts`

```ts
export type Emotion =
  | 'delighted' | 'electrified' | 'furious' | 'gutted' | 'aching' | 'cracked_open'
  | 'unsettled' | 'transported' | 'seen' | 'held' | 'buzzing' | 'bored'

export type WatchlistStatus = 'want_to_see' | 'booked' | 'seen'
export type RoomVolume = 'murmur' | 'applause' | 'standing'

// Profile: belt_level -> house_rank; add ushered_count
// WatchlistItem: rating -> emotions: Emotion[]; add room_volume, performance_at, seat_note
// Review: rating -> emotions: Emotion[]; add prompt
// New: Play, EventAccess, SpectrumSlice { emotion: Emotion; pct: number }

// DELETE: BELT_NAMES, BELT_COLORS
export const HOUSE_RANKS = [
  'Standing Room','Balcony','Mezzanine','Orchestra','Front Row','Green Room','Company',
] as const
```

Deleting `BELT_NAMES` / `BELT_COLORS` is a hard requirement, not cleanup. As long as they compile, some surface will keep rendering a belt.
