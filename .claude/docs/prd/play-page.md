# PRD: Play Page — Frames 4a and 4b

**Feature:** Play-level interest tracking and two-state PlayDetail page  
**Tickets:** F30, F31, F32, F33  
**Design frames:** 4a (STAGED), 4b (UNSTAGED)  
**Status:** Planned  
**Priority:** P1  
**Date:** 2026-08-13  
**Author:** prd-specialist  

---

## 1. Executive Summary

### Problem Statement

`PlayDetail.tsx` currently renders a title, playwright, awards, synopsis, and a production list. For most plays in the database the production list reads `No productions tracked yet.` The page is inert — you cannot want the work, you cannot be told when someone announces it, and there is no other person visible anywhere on the page.

The structural cause is that `watchlist` is keyed to `event_id`. There is no primitive for wanting a *play* — the work itself — when no company is currently staging it. Theater's defining property is that the work is not continuously available. The gap between wanting and being able to attend is the emotional center of being a theatergoer, and the schema has no room for it.

### Solution Overview

Introduce a `play_interest` table — a want keyed to the *work*, scoped to a city, that persists independently of productions. Upgrade `PlayDetail.tsx` to render two states: **4a (STAGED)** when at least one Chicago event exists for the play, and **4b (UNSTAGED)** when none does. Both states show the waiting count, emotion spectrum across all productions ever staged, and the user's social circle. The staged state adds the live announcement. The unstaged state adds an 8-bar monthly trend, library access, and an adjacent thing currently on.

Add a fourth group to `MyShows` — **PLAYS YOU'RE WAITING FOR** — to give `play_interest` a permanent home in the user's record.

### Business Impact

- Converts a dead-end page into a page that converts every visit: the user either wants the work, logs a past sighting, or discovers something adjacent
- Creates demand-signal infrastructure: "318 Chicago users want *Marisol* and nobody has staged it since 2004" is a concrete fact a literary manager can act on — the product becomes leverage for artists
- Increases notification delivery events — every new event creation for a waited-for play triggers a fan-out to all interested users in that city
- Differentiates from Goodreads: the social bond of *shared waiting* (not shared reading) is novel and deeply tied to theater's scarcity model

### Resource Requirements

- 1 migration file (new table + 3 views + RLS)
- 1 new hook (`usePlayInterest`)
- `PlayDetail.tsx` rewrite (upgrade, not replacement — stays at the same route)
- `MyShows.tsx` fourth shelf section
- No new Edge Functions required; all writes are direct-client to Supabase with RLS

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Migration breaks existing events FK | Low | High | Add FK with `on delete cascade`; existing `events.play_id` is already nullable |
| Staged/unstaged detection is wrong | Medium | Medium | Detection is a simple query: `events where play_id = ? and end_date >= today` |
| Play spectrum has no data yet | High | Low | `SpectrumBar` already handles `totalCards < 5` gracefully with dot fallback |
| Friend data empty on first launch | High | Low | YOUR PEOPLE section hidden when `friendsSeen.length === 0 && friendsWaiting.length === 0` |
| Notification fan-out at scale | Low | Medium | Out of scope for this PRD; notification delivery is a separate feature |

---

## 2. Product Overview

### Product Vision

Every play has a page that is alive. A play staged nowhere in Chicago is not a dead page — it is a page with a number, a trend, a crowd of people waiting alongside you, and two things you can do right now. A play being staged is a page with urgency and social proof. The work is always worth a page.

### Target Users

- **Primary:** Chicago-based new theatergoers who discovered a playwright or title through the mentor chat, a friend, or a class, but cannot find a current production
- **Secondary:** Regular theatergoers tracking their history and building a wishlist of works they want to see live
- **Tertiary:** Theater companies using AOA as a distribution channel who want to understand demand before announcing a season

### Value Proposition

For the user: you are not shouting into a void. You are one of 4,201, and you will be told the day someone announces it. For the theater: real demand data from a city audience, scoped to a city, timestamped by when interest was expressed.

### Success Criteria

| Metric | Baseline | Target (90 days post-launch) |
|--------|----------|------------------------------|
| play_interest rows created | 0 | 500+ |
| Plays with 10+ waiters | 0 | 20+ |
| PlayDetail bounce rate | ~90% (dead page) | < 60% |
| MyShows "waiting" shelf visible to users | 0% | 100% signed-in users |

### Assumptions

1. `plays` table is seeded with data (migration `20260803000002_seed_plays.sql` confirmed)
2. `profiles.home_city` is populated for signed-in users (confirmed, defaults to `'chicago'`)
3. `friendships` table with `status = 'accepted'` exists (confirmed)
4. Library link is a static URL to the Chicago Public Library catalog; adjacent play is a curated text field stored on the play record (added in migration)

---

## 3. Functional Requirements

Every requirement follows: trigger → behavior → error state → data → scope boundary.

---

### FR1: Play-level interest toggle ("Want to see it")

**Trigger:** User taps the "Want to see it" button on any play page (staged or unstaged). User must be authenticated.

**Behavior:**
1. Optimistic UI update: button label changes to "You're waiting ✓" immediately. Background changes to `--accent-bg`, border to `1.5px solid --accent`, text color to `--accent-text`. Font stays Newsreader italic 16px. Width stays `flex:1`, height stays 48px.
2. Write `play_interest` row: `{ user_id: auth.uid(), play_id: playId, city: profile.home_city }`. Uses `upsert` with `onConflict: 'user_id,play_id'` to make re-taps idempotent.
3. If the user taps again (the "You're waiting ✓" state), the row is deleted and the button reverts to the default state.
4. WAITING IN CHICAGO count updates optimistically (increment or decrement by 1).

**Error state:** If the upsert fails, revert the button to its prior visual state and show no error banner (silent failure — the user's intent is recorded if connectivity returns). If the delete fails, revert to "You're waiting ✓" state.

**Data:**
- INSERT: `play_interest (user_id, play_id, city)`
- DELETE: `DELETE FROM play_interest WHERE user_id = auth.uid() AND play_id = ?`
- CHECK current state: `SELECT id FROM play_interest WHERE user_id = auth.uid() AND play_id = ?`

**Scope boundary:** No time window on wanting — a user can want a play from any year. No production required. No limit on how many plays a user can want. Toggle is instantaneous — no confirmation dialog.

---

### FR2: Want persists independently of production-level watchlist

**Trigger:** User logs a production of play X as "seen" via the log flow (`/app/log/:eventId`).

**Behavior:** The `play_interest` row for that play is NOT deleted. The play page "You're waiting ✓" state remains after logging a production. The WAITING IN CHICAGO count does not change. If the user then wants to remove their play interest, they do so via the explicit toggle in FR1.

**Error state:** N/A — this is a constraint, not an action.

**Data:** No writes to `play_interest` are triggered by `watchlist` updates.

**Scope boundary:** The "I'VE SEEN IT" button and the "Want to see it" button operate entirely independently. A user can be in both states simultaneously. Future production-level `want_to_see` watchlist entries remain separate objects.

---

### FR3: Staged vs. unstaged detection

**Trigger:** `PlayDetail.tsx` mounts with a `playId` param.

**Behavior:** On mount, fetch:
1. The play record from `plays`
2. All events where `play_id = playId AND end_date >= today` — if any exist, the page renders in STAGED state (4a); if none, renders in UNSTAGED state (4b)
3. The user's existing `play_interest` row (to initialize toggle state)
4. The `play_waiting_counts` view for this play + city
5. All events across any date for this play (for the EVERY ROOM spectrum and past-productions list)

Both states share the same title block (FR4) and action bar (FR1 + FR10). The state determines which sections appear below the action bar.

**Error state:** If the play fetch fails, show "Play not found." centered in `--ink-faint` (existing behavior preserved). If the events fetch fails, default to UNSTAGED state.

**Data:**
- `SELECT * FROM plays WHERE id = ?` — `.single()`
- `SELECT id FROM events WHERE play_id = ? AND end_date >= current_date` — `.maybeSingle()` (just existence check)
- `SELECT * FROM play_interest WHERE user_id = ? AND play_id = ?` — `.maybeSingle()`
- `SELECT waiting FROM play_waiting_counts WHERE play_id = ? AND city = ?` — `.maybeSingle()`

**Scope boundary:** "Staged" means at least one Chicago production with `end_date >= today`. Productions in other cities do not make a play "staged" for Chicago purposes. A play with only past Chicago productions is UNSTAGED.

---

### FR4: Title block (both states)

**Trigger:** Play record loaded successfully.

**Behavior:** Renders at `padding: 0 20px 14px`:
1. Title — Newsreader italic 400, 31px, `line-height: 1.04`, `--ink`
2. Playwright · year — playwright in 15px `--ink-dim`, year in `--ink-faint` with `·` separator; year omitted if null
3. Premise quote — if `plays.premise` is non-null: `border-left: 3px solid var(--accent-border); padding-left: 12px; Newsreader italic 15.5px; line-height: 1.45; --ink-dim`
4. Award chips — if `play.awards` is non-empty: Courier Prime 9px, `letter-spacing: 0.06em`, `--accent`, `border: 1px solid --accent-border`, `border-radius: 2px`, `padding: 2px 6px`, `text-transform: uppercase`, flex-wrap, `gap: 6px`, `margin-bottom: 14px`

**Error state:** Render the title block with available data; omit optional fields (premise, awards) rather than showing errors.

**Data:** `plays.title`, `plays.playwright`, `plays.year_written`, `plays.awards`, `plays.premise` (new column added in migration).

**Scope boundary:** The premise is a single editorially written sentence, stored in the DB. No AI generation on the client. If `plays.premise` is null, the premise block is omitted entirely — no fallback copy is invented.

---

### FR5: WAITING IN CHICAGO card (both states)

**Trigger:** Page load completes with waiting count available.

**Behavior:**
- Container: `border: 1px solid var(--accent-border); background: var(--accent-bg); border-radius: 3px; padding: 14px 15px`
- Header row: label "WAITING IN CHICAGO" in Courier Prime 9.5px `letter-spacing: 0.18em` `--accent-text`, count right-aligned in JetBrains Mono 14px `--accent-text`
- Interpretation sentence: Newsreader 14.5px `--ink-dim`, generated by `interpretWaitingCount(count)` (new pure function in `emotions.ts` or a separate `waiting.ts` utility)
- STAGED STATE ONLY: below a `1px dotted var(--rule)` rule, a footer row: live green dot (6px circle, `var(--live)`) + "SOMEONE ANNOUNCED IT — SEE BELOW" in Courier Prime 9.5px `--accent-text`
- UNSTAGED STATE ONLY: the 8-bar monthly trend (FR6) renders inside this card, below the interpretation sentence

**Error state:** If waiting count fetch returns null or 0, show "0" as the count; the card still renders.

**Data:** `SELECT waiting FROM play_waiting_counts WHERE play_id = ? AND city = ?` — returns 0 if no row.

**Scope boundary:** City is always the user's `home_city` from their profile, defaulting to `'chicago'`. Counts from other cities are not shown. If the user has no profile (unauthenticated), city defaults to `'chicago'` and count shows the Chicago aggregate.

---

### FR6: 8-bar monthly trend (UNSTAGED state only, inside WAITING IN CHICAGO card)

**Trigger:** UNSTAGED state, page load complete.

**Behavior:**
1. Query `play_waiting_trend` view: 8 rows, each with `month` (YYYY-MM) and `count` for the given `play_id` and `city`
2. Render 8 bars in a flex container: `height: 34px; gap: 3px`. Each bar: `flex: 1; border-radius: 1px`. Bar height as percentage of container: `height: ${(count / maxCount) * 100}%`. Align bars to bottom of container via `align-items: flex-end` on the parent.
3. Color ramp: oldest bar `oklch(0.80 0.06 55)`, newest bar `var(--accent)`. Intermediate bars linearly interpolated in oklch space between those two values across the 8 positions.
4. If fewer than 8 months of data exist, render only the available bars — do not pad with zero bars.
5. Below the bars, a context sentence: `interpretWaitingTrend(trend)` — a pure function that outputs one of several canned sentences depending on shape (rising, falling, spike, flat).

**Error state:** If `play_waiting_trend` returns no rows, the 8-bar section is omitted entirely; the WAITING IN CHICAGO card still renders with just count and interpretation.

**Data:** `SELECT month, count FROM play_waiting_trend WHERE play_id = ? AND city = ? ORDER BY month ASC LIMIT 8`

**Scope boundary:** Trend is city-scoped. The 8 bars represent the 8 most recent calendar months. Months with zero interest additions are included in the view as 0-count rows (the view uses `generate_series` to fill gaps). The trend does NOT appear in the STAGED state — the "SOMEONE ANNOUNCED IT" footer takes that space.

---

### FR7: EVERY ROOM spectrum section (both states)

**Trigger:** Page load, play has at least one production ever (in any city).

**Behavior:**
- Section renders on `--bg-card`, with `border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule)`; `padding: 14px 20px`
- Label: "EVERY ROOM, EVERY PRODUCTION" (STAGED) or "EVERY ROOM, EVERYWHERE" (UNSTAGED) — Courier Prime 11px `letter-spacing: 0.14em` `--ink-faint`
- `SpectrumBar` component with `height={11}`, `slices` from `play_emotion_counts`, `totalCards` from sum of all weights
- Top 3 emotions labeled below the bar using `ink()` on light theme (see `emotions.ts` — `base()` function). Labels use the existing `SpectrumBar` label pattern.
- `InterpretationSentence` component with those slices and totalCards
- Total card count shown in Courier Prime 9.5px `--ink-ghost`: e.g., "ACROSS 47 PEOPLE WHO SAW IT"

**Error state:** If `play_emotion_counts` returns no rows (play has never been logged with emotions), the section is omitted entirely rather than rendering an empty bar.

**Data:** `SELECT emotion, weight FROM play_emotion_counts WHERE play_id = ?` — aggregated across all events of this play, all cities

**Scope boundary:** Spectrum is cross-city — it aggregates emotions from every production ever logged, not just Chicago. This is intentional: it shows the work's emotional signature regardless of where it was staged. The label "EVERYWHERE" vs. "EVERY PRODUCTION" signals this distinction.

---

### FR8: JUST ANNOUNCED section (STAGED state only)

**Trigger:** STAGED state — at least one Chicago event with `end_date >= today`.

**Behavior:**
- Section header: live green dot (6px, `var(--live)`) + "JUST ANNOUNCED · CHICAGO" in Courier Prime 11px `letter-spacing: 0.14em` `--ink-faint`
- For the current production (the soonest `end_date >= today`):
  - Venue name: Newsreader italic 19px `--ink`
  - Dates: Courier Prime 10px `--accent-text` (formatted as "MAR 7 – APR 4")
  - Director: 14px `--ink-dim` (or "director not announced" in `--ink-faint` if null)
  - Cast: 14px `--ink-dim` first cast member name + role, truncated after 2 members with "+ N more"
  - Two action buttons at 40px height, `gap: 8px`:
    - "TELL ME WHEN ON SALE" — Courier Prime 10px, `--accent-on` on `--accent`, `border-radius: 2px`, `flex: 1`. On tap: writes a `sale_notifications` entry (out-of-scope for this PRD; button logs intent to console for now and shows a "We'll let you know" toast)
    - "SHARE" — Courier Prime 10px, `--ink-dim` on `1px solid --rule`, width: 72px. On tap: invokes `navigator.share()` with the play URL; falls back to copying URL to clipboard with a "Copied" toast
- Below a `1px dotted var(--rule)` divider: past productions list (events with `end_date < today` for this play in Chicago), max 2 rows. Each row: year (Courier Prime 10px `--ink-ghost`) + venue name (Newsreader italic 15px `--ink-dim`) + right-aligned seat count "28 SEATS" (Courier Prime 9.5px `--ink-ghost`) if `venue.seat_count` is non-null
- If more than 2 past productions exist, show "ALL PRODUCTIONS →" in Courier Prime 10px `--accent` that navigates to `/app/play/:playId/productions` (out-of-scope — for now, omit the link if more than 2 exist; show only the cap)

**Error state:** If only one past production exists, render only that row. If no past productions exist, omit the dotted divider and past-productions list entirely.

**Data:**
- `SELECT * FROM events WHERE play_id = ? AND end_date >= today ORDER BY end_date ASC LIMIT 1` (current production)
- `SELECT e.start_date, e.end_date, v.name, v.seat_count FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.play_id = ? AND e.end_date < today ORDER BY e.end_date DESC LIMIT 2` (past productions)

**Scope boundary:** Only Chicago events (city-scoped via venue lookup). Director and cast come from `events.cast_members` (JSONB array). "Casting not announced" is shown verbatim when cast_members is null or empty — never leave the field blank.

---

### FR9: UNTIL SOMEBODY STAGES IT section (UNSTAGED state only)

**Trigger:** UNSTAGED state — no Chicago events with `end_date >= today`.

**Behavior:**
- Section header: "UNTIL SOMEBODY STAGES IT" in Courier Prime 11px `letter-spacing: 0.14em` `--ink-faint`; `padding: 14px 20px 0`
- Two rows, divided by `1px dotted var(--rule)`:

**Row 1 — Library:**
- Lead text: "Read it. It's ninety pages." (or the runtime sentence stored in `plays.read_prompt` if non-null)
- Below: "AT THE HAROLD WASHINGTON LIBRARY · FREE" in Courier Prime 10px `var(--access)` (green token)
- "FIND IT →" link button: Courier Prime 10px `var(--access)`, taps open `plays.library_url` in a new tab. If `library_url` is null, shows "FIND IT AT CHIPUBLIB.ORG →" pointing to `https://catalog.chipublib.org/search/?q={encodeURIComponent(plays.title)}`

**Row 2 — Adjacent thing:**
- If `plays.adjacent_event_id` is non-null and that event's `end_date >= today`: shows that event's title in Newsreader italic 17px `--ink`, venue in Courier Prime 10px `--ink-faint`, a "LOOK →" link navigating to `/app/show/{adjacent_event_id}`
- If `plays.adjacent_event_id` is null or that event has ended: query for the most recent Chicago event by the same playwright (via `events JOIN plays ON plays.id = events.play_id WHERE plays.playwright = ? AND events.end_date >= today LIMIT 1`). Show that event the same way.
- If neither yields a result: show a fallback row: "See what's at the Goodman tonight →" linking to `https://www.goodmantheatre.org`

**Error state:** Row 1 always renders (library URL is always resolvable). Row 2 always renders (fallback guaranteed). The section never shows "nothing available."

**Data:**
- `plays.library_url` (new column)
- `plays.read_prompt` (new column, nullable)
- `plays.adjacent_event_id` (new FK column, nullable, references `events.id`)
- Playwright same-city query as described above

**Scope boundary:** This section exists ONLY in the UNSTAGED state. It does not appear when a Chicago production exists. The library link always goes to a real Chicago Public Library URL — never fabricated.

---

### FR10: YOUR PEOPLE section (both states)

**Trigger:** Page load, user is authenticated with at least one accepted friend.

**Behavior — STAGED state:**
- 34px avatar (circular, `border-radius: 50%`), with `--bg` ring 1.5px. Avatar is `profiles.avatar_url` or initials fallback
- Friend name + Newsreader italic 13.5px quote with `border-left: 2px solid var(--rule); padding-left: 10px; --ink-dim`
- Quote is the friend's `watchlist.reflection` for any event of this play, truncated to 80 chars. If `share_reflections = false` for that friend, show "..." as the quote
- Show the single most recent friend who has seen this play
- Summary line in Courier Prime 10px `--ink-ghost`: "+ N OTHERS HAVE SEEN IT · M ARE WAITING" where N = (total friends who have seen) - 1 and M = total friends in `play_interest` for this play

**Behavior — UNSTAGED state:**
- Overlapping 30px avatars, `margin-left: -9px` from second avatar onward, `border: 2px solid var(--bg)` ring
- One line: "Mara, Dev and Inés are waiting for this one too." (first 2 names + "and {name}" or "and N others") — Newsreader italic 14px `--ink-dim`

**Hidden when:** No accepted friends have seen this play AND no accepted friends are in `play_interest` for this play. Section is omitted entirely, no empty state.

**Privacy constraint:** Only users with an `accepted` friendship appear. Anonymous or pending users are never surfaced. No individual waiter is identifiable beyond accepted friends; aggregate counts use `play_waiting_counts` view (city-scoped, no user IDs exposed).

**Error state:** If friends query fails, section is omitted silently.

**Data:**
- Friends who have seen: `SELECT w.reflection, p.username, p.avatar_url, p.share_reflections FROM watchlist w JOIN profiles p ON p.id = w.user_id JOIN friendships f ON (f.requester_id = w.user_id OR f.addressee_id = w.user_id) WHERE (f.requester_id = auth.uid() OR f.addressee_id = auth.uid()) AND f.status = 'accepted' AND w.user_id != auth.uid() AND w.status = 'seen' AND w.event_id IN (SELECT id FROM events WHERE play_id = ?)`
- Friends who are waiting: `SELECT p.username, p.avatar_url FROM play_interest pi JOIN profiles p ON p.id = pi.user_id JOIN friendships f ON ... WHERE pi.play_id = ? AND pi.user_id != auth.uid()`

**Scope boundary:** YOUR PEOPLE must render within 844px height — it is never the section that clips off the page. It renders last in the layout. In STAGED state, only one friend quote appears. In UNSTAGED state, only overlapping avatars appear (no quotes). Max 3 avatars shown in UNSTAGED; excess folded into count.

---

### FR11: "I'VE SEEN IT" button (both states)

**Trigger:** User taps "I'VE SEEN IT" in the action bar.

**Behavior:** Navigate to `/app/log/{mostRecentChicagoEventId}` if a Chicago event exists for this play. If no events exist (fully unstaged), navigate to `/app/log/untracked?play_id={playId}` — this route is out-of-scope for this PRD, so for now show a toast: "Pick a show to log from the map or ask your mentor — we'll add the log flow soon."

**Error state:** Toast appears and user remains on the play page. No navigation occurs.

**Data:** Uses the events already fetched during FR3 to determine the most recent Chicago event.

**Scope boundary:** The button is always rendered. It is never disabled. The log flow itself (emotions, reflection, house check) is unchanged — this FR only covers the navigation trigger.

---

### FR12: MyShows — PLAYS YOU'RE WAITING FOR shelf

**Trigger:** User opens MyShows. User has at least one `play_interest` row.

**Behavior:**
- Add a fourth group below the three existing shelves (Want to See, Tickets Booked, Seen) in the Marquee view
- Section header: "PLAYS YOU'RE WAITING FOR" in Courier Prime 9px `letter-spacing: 0.1em` `--ink-faint`, count right in JetBrains Mono 12px `--accent`
- Each row: play title in Newsreader italic 17px `--ink`, playwright in Courier Prime 10px `--ink-dim`, right-aligned status chip
  - If no current Chicago event: "NOBODY'S STAGING IT" in Courier Prime 10px `--ink-ghost`
  - If current Chicago event exists: "ANNOUNCED · {MON YYYY}" in Courier Prime 10px `--accent-text`
- Tapping any row navigates to `/app/play/{playId}`
- Section is omitted entirely when `play_interest` count is 0 (no empty state — the section simply does not appear)

**Error state:** If `play_interest` fetch fails, section is omitted silently.

**Data:** `SELECT pi.play_id, p.title, p.playwright, e.end_date, e.start_date FROM play_interest pi JOIN plays p ON p.id = pi.play_id LEFT JOIN events e ON e.play_id = pi.play_id AND e.end_date >= today WHERE pi.user_id = auth.uid() ORDER BY pi.created_at DESC`

**Scope boundary:** Additive-only to `MyShows.tsx`. The existing three shelves are unchanged. The new shelf appears only in Marquee view (the existing four-tab Ledger view is out of scope for this PRD).

---

## 4. Non-Functional Requirements

### Performance

- PlayDetail initial load: all data fetched in a single `Promise.all()` of 4 parallel queries; target < 800ms on 4G
- `play_waiting_counts` view has an index on `(play_id, city)` — count reads are O(1)
- Trend data from `play_waiting_trend` uses a materialized or indexed approach (see Technical section)
- `play_emotion_counts` table is pre-aggregated via trigger (same pattern as `event_emotion_counts`) — no GROUP BY on hot path

### Security

- `play_interest` RLS: users read and write only their own rows
- Aggregate counts exposed via views only — no client query ever reads another user's `play_interest` row
- `play_waiting_counts` view is public (like `event_emotion_counts`) — it exposes only city-scoped counts, never user IDs
- Friend data queries must include `AND f.status = 'accepted'` — pending friendships never surface

### Accessibility

- All interactive elements (Want to see it, I'VE SEEN IT, FIND IT, SHARE) must have `aria-label` attributes
- "Want to see it" / "You're waiting ✓" toggle must have `aria-pressed` to signal state to screen readers
- Avatar images must have `alt={username}` or `alt="Theater fan"` if no name available
- Color is never the sole differentiator — the live green dot for STAGED state is always accompanied by text
- Minimum tap target: 44px height. Both action bar buttons meet this (`height: 48px`)

### Reliability

- Optimistic UI for toggle (FR1): if the network write fails, the button reverts — never leaves the UI in a lying state
- Page renders in UNSTAGED state if events query fails (safe default)
- All sections are independently fallible — a failure in YOUR PEOPLE does not prevent the title block or action bar from rendering

### Compliance

- No individual waiter is identifiable beyond accepted friends (spec requirement)
- `share_reflections` flag respected in YOUR PEOPLE quote display
- Library URL points to a real publicly accessible resource — no paywalled content linked as "free"

---

## 5. Technical Considerations

### Data Model

#### New Table: `play_interest`

```sql
create table public.play_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  play_id uuid not null references public.plays(id) on delete cascade,
  city text not null,
  created_at timestamptz not null default now()
);
create unique index on public.play_interest (user_id, play_id);
create index on public.play_interest (play_id, city);
create index on public.play_interest (play_id, city, created_at);
```

#### New Columns on `plays`

```sql
alter table public.plays add column premise text;
alter table public.plays add column read_prompt text;
alter table public.plays add column library_url text;
alter table public.plays add column adjacent_event_id uuid references public.events(id) on delete set null;
```

#### New View: `play_waiting_counts`

```sql
create view public.play_waiting_counts as
select play_id, city, count(*)::int as waiting
from public.play_interest
group by play_id, city;
```

#### New View: `play_waiting_trend`

```sql
create view public.play_waiting_trend as
select
  pi.play_id,
  pi.city,
  to_char(date_trunc('month', pi.created_at), 'YYYY-MM') as month,
  count(*)::int as count
from public.play_interest pi
group by pi.play_id, pi.city, date_trunc('month', pi.created_at);
```

The client queries this view with `WHERE play_id = ? AND city = ? ORDER BY month ASC` and generates the 8-bar set from the last 8 rows.

#### New Table: `play_emotion_counts`

```sql
create table public.play_emotion_counts (
  play_id uuid not null references public.plays(id) on delete cascade,
  emotion text not null,
  weight numeric not null default 0,
  primary key (play_id, emotion)
);

alter table public.play_emotion_counts enable row level security;

create policy "Anyone can read play emotion counts"
  on public.play_emotion_counts for select using (true);
```

Populate via a trigger on `event_emotion_counts` (after insert/update): for each `event_id`, resolve `events.play_id` and propagate the weight delta to `play_emotion_counts`. This follows the exact same pattern as `profile_emotion_counts` in `20260731100005_emotion_aggregates.sql`.

### RLS Policies

```sql
alter table public.play_interest enable row level security;

create policy "Users manage their own play interest"
  on public.play_interest for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- play_waiting_counts is a view — inherits play_interest RLS for writes;
-- for reads, grant SELECT to anon and authenticated roles
grant select on public.play_waiting_counts to anon, authenticated;
grant select on public.play_waiting_trend to anon, authenticated;
grant select on public.play_emotion_counts to authenticated;
```

### New Hook: `usePlayInterest(playId: string)`

File: `src/hooks/usePlayInterest.ts`

Returns:
```typescript
interface UsePlayInterestReturn {
  isWaiting: boolean       // user has a play_interest row for this play
  waitingCount: number     // city-scoped count from play_waiting_counts
  trend: TrendBucket[]     // up to 8 monthly buckets from play_waiting_trend
  toggle: () => Promise<void>  // upsert or delete, optimistic
  loading: boolean
}

interface TrendBucket {
  month: string    // 'YYYY-MM'
  count: number
}
```

Pattern: mirrors `useWatchlist.ts` exactly — optimistic state, `useCallback` for toggle, `useEffect` for initial load. Uses `useAuth()` for `user` and `user.id`. Reads `profile.home_city` from a `supabase.from('profiles').select('home_city').eq('id', user.id).maybeSingle()` call on mount.

### `PlayDetail.tsx` Upgrade

The existing `PlayDetail.tsx` at `src/pages/PlayDetail.tsx` is replaced in full. The route (`/app/play/:playId`) is unchanged. The new file imports:

```typescript
import { usePlayInterest } from '../hooks/usePlayInterest'
import { SpectrumBar } from '../components/SpectrumBar'
import { InterpretationSentence } from '../components/InterpretationSentence'
import { useAuth } from '../contexts/AuthContext'
```

Top-level state:
```typescript
const { playId } = useParams<{ playId: string }>()
const navigate = useNavigate()
const { user } = useAuth()
const { isWaiting, waitingCount, trend, toggle, loading: interestLoading } = usePlayInterest(playId!)
const [play, setPlay] = useState<Play | null>(null)
const [currentProductions, setCurrentProductions] = useState<Event[]>([])  // end_date >= today
const [pastProductions, setPastProductions] = useState<Event[]>([])         // end_date < today
const [playSlices, setPlaySlices] = useState<SpectrumSlice[]>([])
const [playTotalCards, setPlayTotalCards] = useState(0)
const [friendsSeen, setFriendsSeen] = useState<FriendSeen[]>([])
const [friendsWaiting, setFriendsWaiting] = useState<FriendWaiting[]>([])
const [loading, setLoading] = useState(true)
```

`isStaged = currentProductions.length > 0`

### Integration with LogShow

`/app/log/:eventId` is unchanged. The "I'VE SEEN IT" button passes the `event_id` of the most recently started Chicago event (first from `currentProductions`, fallback to first from `pastProductions`). If neither exists, a toast is shown.

### Technology Stack (unchanged)

- React 19 + TypeScript + Vite + Tailwind CSS
- Direct Supabase client queries (no Edge Function required)
- No new third-party dependencies

---

## 6. UI/UX Specifications

### Layout — STAGED state (4a), top to bottom

```
[Chrome: ← / THE PLAY / ⋯]                     padding: 0 20px
[Title block]                                    padding: 0 20px 14px
[Action bar: "Want to see it" + "I'VE SEEN IT"] padding: 0 20px 14px; gap: 9px
[WAITING IN CHICAGO card]                        margin: 0 20px 14px
[EVERY ROOM, EVERY PRODUCTION]                  border top+bottom; padding: 14px 20px
[JUST ANNOUNCED · CHICAGO]                       padding: 14px 20px
[YOUR PEOPLE]                                    padding: 14px 20px
```

### Layout — UNSTAGED state (4b), top to bottom

```
[Chrome: ← / THE PLAY / ⋯]
[Title block]
[Action bar]
[WAITING IN CHICAGO card (with 8-bar trend)]
[EVERY ROOM, EVERYWHERE]
[UNTIL SOMEBODY STAGES IT]
[YOUR PEOPLE]
```

### Chrome row

```
flex; justify-between; align-items: center; padding: 12px 20px 8px
← button: 44px tap target, navigate(-1)
"THE PLAY": Courier Prime 10px, letter-spacing: 0.14em, --ink-faint
⋯ button: 44px tap target, reserved (no-op for now)
```

### Action bar

```
display: flex; gap: 9px; padding: 0 20px 14px
"Want to see it" button:
  flex: 1; height: 48px
  Default:  background: --accent; color: --accent-on; border: none; border-radius: 3px
            font: Newsreader italic 16px
  Waiting:  background: --accent-bg; color: --accent-text; border: 1.5px solid --accent
  aria-pressed: true/false
"I'VE SEEN IT" button:
  width: 104px; height: 48px
  background: none; border: 1px solid --rule; border-radius: 3px; color: --ink-dim
  font: Courier Prime 10px, letter-spacing: 0.14em
```

### Mobile constraints

- Viewport: 390 × 844px (iPhone 14 reference)
- Page scrolls vertically; no horizontal scroll
- YOUR PEOPLE must render visible without scroll on a play page with minimal content — implement by ensuring it does not have a fixed minimum height; it collapses to its natural size
- All tap targets ≥ 44px height
- Light theme is primary; dark theme is secondary (tokens already wired via `ThemeContext`)

### Empty and loading states

| State | Display |
|-------|---------|
| Loading | Centered spinner (existing pattern: `--ink-faint` loading div) |
| Play not found | "Play not found." centered in `--ink-faint` (existing behavior preserved) |
| 0 waiters | WAITING IN CHICAGO renders with "0" count — card still visible |
| No spectrum data | EVERY ROOM section omitted |
| No friends activity | YOUR PEOPLE section omitted |
| No trend data | 8-bar section omitted (UNSTAGED); rest of WAITING card renders normally |

---

## 7. User Stories

### US1
As a newcomer to theater, I want to mark a play I've heard about so that I'll know when someone in Chicago announces it.  
**Acceptance:** Given a play with no Chicago productions, when I tap "Want to see it," then the button reads "You're waiting ✓" and my interest persists after page reload.

### US2
As a regular theatergoer, I want to see how many other people in Chicago want to see a play so that I know I'm not alone in waiting for it.  
**Acceptance:** Given any play page, the WAITING IN CHICAGO card shows a count that reflects the real aggregate from `play_waiting_counts`.

### US3
As a user who logged a past production, I want my play interest to remain active so that I can still be notified when a great new staging is announced.  
**Acceptance:** Given a user with `play_interest` row and a `watchlist` seen entry for the same play, when the user reloads the play page, the button still reads "You're waiting ✓."

### US4
As a user browsing an unstaged play, I want to see if interest has grown recently so that I can gauge whether an announcement might be coming.  
**Acceptance:** Given an unstaged play, the WAITING IN CHICAGO card shows 8 monthly bars with the oldest bar lighter than the newest.

### US5
As a user on an unstaged play page, I want to know what I can do right now so that my visit is not wasted.  
**Acceptance:** Given an unstaged play, the UNTIL SOMEBODY STAGES IT section shows a library link (always present) and an adjacent thing currently on (or a fallback to Goodman website).

### US6
As a user, I want to see what my friends think of a play so that I can decide whether to want it.  
**Acceptance:** Given accepted friends who have seen a play, the YOUR PEOPLE section shows one friend's quote and a summary count.

### US7
As a user, I want to see all the plays I'm waiting for in one place so that I can manage my wishlist.  
**Acceptance:** Given plays in `play_interest`, the MyShows marquee view shows a "PLAYS YOU'RE WAITING FOR" section with each play's title, playwright, and current staging status.

---

## 8. Success Metrics

| Metric | How measured | Target |
|--------|-------------|--------|
| `play_interest` rows created (30-day cumulative) | `SELECT count(*) FROM play_interest WHERE created_at >= now() - interval '30 days'` | 200+ |
| Toggle retention (users who toggle and don't immediately untoggle) | Row exists 24h after creation | > 80% |
| PlayDetail scroll depth (users who reach YOUR PEOPLE) | Client analytics event `play_detail_scroll_people` | > 40% of play page visits |
| MyShows waiting shelf interactions | Navigate from shelf row to play page | > 20% of users with play_interest rows |

---

## 9. Rollout Plan

**Phase 1 — Migration only (no UI)**
- Deploy `20260813000001_play_interest.sql` to production
- Verify RLS policies are enforced
- Verify views return correct data

**Phase 2 — Hook + PlayDetail upgrade**
- Deploy `usePlayInterest.ts` hook
- Deploy upgraded `PlayDetail.tsx`
- Smoke test on iPhone (390px viewport, light theme)

**Phase 3 — MyShows shelf**
- Add PLAYS YOU'RE WAITING FOR to `MyShows.tsx` MarqueeView
- Verify zero-state behavior (section hidden when no interests)

**No feature flags required** — the changes are additive. The existing PlayDetail stub is replaced; the route and URL structure are unchanged.

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `play_emotion_counts` trigger fires on every watchlist write | Trigger only fires on emotion column changes (`AFTER INSERT OR UPDATE OF emotions`) — same pattern as existing triggers |
| `play_waiting_trend` view is slow on large datasets | Index on `(play_id, city, created_at)` covers the GROUP BY; if slow, convert to materialized view with daily refresh |
| Adjacent event reference goes stale (event ends) | `plays.adjacent_event_id` FK `on delete set null`; client falls back to playwright query automatically |
| Library URL is dead | URL is stored in DB — can be updated by admin without a deploy |
| Notification fan-out (promised in design spec) | Notification delivery is explicitly out of scope for this PRD. The TELL ME WHEN ON SALE button logs intent only. Notification system is a separate P1 feature. |

---

---

## Architecture

### Constraint

This work is **additive only**. We modify `src/pages/PlayDetail.tsx` and create new supporting files. No other existing page, component, or hook is changed.

---

### New Files

```
supabase/migrations/20260813000001_play_interest.sql
src/lib/types.ts                                    (additive: PlayInterest, PlayWaiting, PlayWaitingTrend)
src/lib/emotions.ts                                 (additive: ink(), fillLight(), edgeLight())
src/hooks/usePlayInterest.ts                        (new)
src/hooks/usePlaySpectrum.ts                        (new)
src/components/play/PlayActionBar.tsx               (new)
src/components/play/WaitingBlock.tsx                (new)
src/components/play/PlaySpectrumBlock.tsx           (new)
src/components/play/StagedProductionsBlock.tsx      (new)
src/components/play/UnstagedBlock.tsx               (new)
src/components/play/PlayPeopleBlock.tsx             (new)
src/pages/PlayDetail.tsx                            (modify: full upgrade, replace ~238 lines)
```

No other file is created or modified.

---

### Migration DDL

File: `supabase/migrations/20260813000001_play_interest.sql`

The migration creates four objects in order:

1. `play_interest` table with unique index on `(user_id, play_id)` and index on `(play_id, city, created_at)`
2. `play_waiting_counts` view — city-scoped aggregate counts, public readable
3. `play_waiting_trend` view — monthly buckets per play+city, used for the 8-bar sparkline
4. `play_emotion_counts` table — pre-aggregated emotion weights across all productions of a play, seeded empty (trigger populated in a future ticket)

Also adds four columns to `plays`:
- `premise text` — one editorially written sentence, no AI generation
- `read_prompt text` — optional override for the library row copy
- `library_url text` — CPL catalog link; fallback generated client-side from title if null
- `adjacent_event_id uuid references events(id) on delete set null` — curated adjacent show for unstaged state

Full DDL is in Technical Considerations §5.

---

### Type Additions (`src/lib/types.ts`)

Append three interfaces to the existing file. No existing interfaces are modified.

```ts
export interface PlayInterest {
  id: string
  user_id: string
  play_id: string
  city: string
  created_at: string
}

export interface PlayWaiting {
  play_id: string
  city: string
  waiting: number
}

export interface PlayWaitingTrend {
  play_id: string
  city: string
  month: string   // 'YYYY-MM'
  count: number
}
```

`SpectrumSlice` is already exported from `types.ts` via re-export from `emotions.ts`. No change needed.

---

### Emotion Helper Additions (`src/lib/emotions.ts`)

Append three exports after the existing `bright` function. Do not modify any existing export.

```ts
export const ink       = (e: EmotionDef) =>
  `oklch(${Math.min(e.l - 0.14, 0.48).toFixed(2)} ${e.c} ${e.h})`
export const fillLight = (e: EmotionDef) =>
  `oklch(0.94 ${(e.c * 0.25).toFixed(3)} ${e.h})`
export const edgeLight = (e: EmotionDef) =>
  `oklch(0.72 ${(e.c * 0.5).toFixed(3)} ${e.h})`
```

Usage contract per THEMING.md:
- Spectrum bar segment fill: `base(e)` on both themes (unchanged)
- Spectrum percentage label text: `ink(e)` on light, `base(e)` on dark
- Pill background: `fillLight(e)` on light, `fill(e)` on dark
- Pill border: `edgeLight(e)` on light, `edge(e)` on dark
- Pill text: `ink(e)` on light, `bright(e)` on dark

Theme is resolved once from `ThemeContext` in the calling component and passed as a boolean `isDark` prop — no theme branching inside `emotions.ts` functions.

---

### Hook: `usePlayInterest`

File: `src/hooks/usePlayInterest.ts`

```ts
interface TrendBucket { month: string; count: number }

export interface UsePlayInterestResult {
  isWaiting: boolean
  waitingCount: number        // 0 when no row in play_waiting_counts
  trend: TrendBucket[]        // up to 8 items, ordered oldest → newest
  loading: boolean
  toggle: () => Promise<void>
}

export function usePlayInterest(playId: string): UsePlayInterestResult
```

Implementation:
- On mount, runs three parallel queries via `Promise.all`:
  1. `play_interest WHERE user_id = auth.uid() AND play_id = ?` — `.maybeSingle()` → `isWaiting`
  2. `play_waiting_counts WHERE play_id = ? AND city = profile.home_city` — `.maybeSingle()` → `waitingCount`
  3. `play_waiting_trend WHERE play_id = ? AND city = ? ORDER BY month ASC` — array → `trend`
- `profile.home_city` is fetched once on mount alongside the above three
- `toggle()` upserts (with `onConflict: 'user_id,play_id'`) or deletes, optimistic update on `isWaiting` and `waitingCount`
- Pattern mirrors `useWatchlist.ts` exactly: `useCallback` for toggle, `useEffect` for load

---

### Hook: `usePlaySpectrum`

File: `src/hooks/usePlaySpectrum.ts`

```ts
export interface UsePlaySpectrumResult {
  slices: SpectrumSlice[]
  totalCards: number
  loading: boolean
}

export function usePlaySpectrum(playId: string): UsePlaySpectrumResult
```

Implementation:
- Queries `play_spectrum` view (created in migration) for all rows where `play_id = ?`
- Derives `totalCards` from a second query: `SELECT sum(weight) FROM play_emotion_counts WHERE play_id = ?`
- Returns empty slices + 0 totalCards when no data — `SpectrumBar` natively handles `totalCards < 5` with dots + EARLY DAYS label

---

### Component Signatures

All components live in `src/components/play/`. No existing component files are modified.

**`PlayActionBar.tsx`**
```ts
interface Props {
  isWaiting: boolean
  onWantToggle: () => void
  onLogSeen: () => void
}
export function PlayActionBar(props: Props): JSX.Element
```

**`WaitingBlock.tsx`**
```ts
interface Props {
  city: string
  waitingCount: number
  trend?: TrendBucket[]        // present → renders 8-bar sparkline (unstaged)
  hasActiveProduction: boolean // true → renders "SOMEONE ANNOUNCED IT" footer (staged)
}
export function WaitingBlock(props: Props): JSX.Element
```

**`PlaySpectrumBlock.tsx`**
```ts
interface Props {
  slices: SpectrumSlice[]
  totalCards: number
  mode: 'staged' | 'unstaged'  // controls label copy
  isDark: boolean               // drives ink() vs base() on percentage labels
}
export function PlaySpectrumBlock(props: Props): JSX.Element
```
Uses `<SpectrumBar height={11} />` and `<InterpretationSentence />` — both imported unmodified.

**`StagedProductionsBlock.tsx`**
```ts
interface ProductionRow { event: Event; userSeen: boolean; userSeenDate: string | null }
interface Props {
  productions: ProductionRow[]
  onProductionClick: (eventId: string) => void
}
export function StagedProductionsBlock(props: Props): JSX.Element
```
Extracts the existing production-list rendering from `PlayDetail.tsx`. Logic and visual treatment unchanged.

**`UnstagedBlock.tsx`**
```ts
interface Props {
  playTitle: string
  playwright: string
  libraryUrl?: string | null
  adjacentEvent?: Pick<Event, 'id' | 'title'> & { venueName?: string } | null
}
export function UnstagedBlock(props: Props): JSX.Element
```

**`PlayPeopleBlock.tsx`**
```ts
interface FriendWatcher {
  friendName: string
  avatarUrl: string | null
  relation: 'seen' | 'waiting'
  seenCity?: string
  seenYear?: number
  quote?: string | null
}
interface Props {
  friends: FriendWatcher[]
  othersSeenCount: number
  othersWaitingCount: number
  mode: 'staged' | 'unstaged'
}
export function PlayPeopleBlock(props: Props): JSX.Element
```

---

### Upgraded `PlayDetail.tsx` Render Tree

```
<div scroll container padding="20px">
  <ChromeRow>                     // inline, 3 elements: ← / THE PLAY / ⋯
  <TitleBlock>                    // inline: title, playwright, year, premise, awards
  <PlayActionBar
    isWaiting={isWaiting}
    onWantToggle={toggle}
    onLogSeen={handleLogSeen}
  />
  <WaitingBlock
    city={userCity}
    waitingCount={waitingCount}
    trend={mode === 'unstaged' ? trend : undefined}
    hasActiveProduction={mode === 'staged'}
  />
  {playSlices.length > 0 && (
    <PlaySpectrumBlock
      slices={playSlices}
      totalCards={playTotalCards}
      mode={mode}
      isDark={isDark}
    />
  )}
  {mode === 'staged'
    ? <StagedProductionsBlock
        productions={allProductions}
        onProductionClick={id => navigate(`/app/show/${id}`)}
      />
    : <UnstagedBlock
        playTitle={play.title}
        playwright={play.playwright}
        libraryUrl={play.library_url}
        adjacentEvent={adjacentEvent}
      />
  }
  {(friendsSeen.length > 0 || friendsWaiting.length > 0) && (
    <PlayPeopleBlock
      friends={[...friendsSeen, ...friendsWaiting]}
      othersSeenCount={othersSeenCount}
      othersWaitingCount={othersWaitingCount}
      mode={mode}
    />
  )}
</div>
```

---

### Data Flow

```
PlayDetail.tsx (orchestrator)
  |
  |-- Promise.all([
  |     supabase.from('plays').eq('id', playId).single()
  |     supabase.from('events').select('*, venue:venues(*)').eq('play_id', playId)
  |     supabase.from('watchlist').eq('user_id', user.id).eq('status','seen').in('event_id', ...)
  |   ]) --> play, allEvents, seenMap
  |
  |-- usePlayInterest(playId)
  |     -- parallel internal queries:
  |     -- play_interest (isWaiting)
  |     -- play_waiting_counts (waitingCount)
  |     -- play_waiting_trend (trend)
  |     -- profiles.home_city (city)
  |
  |-- usePlaySpectrum(playId)
  |     -- play_spectrum (slices)
  |     -- play_emotion_counts sum (totalCards)
  |
  `-- useEffect (friends, fires after play loads + friendIds resolved)
        -- friendships WHERE status='accepted' AND (requester=me OR addressee=me)
        -- play_interest WHERE play_id=? AND user_id IN (friendIds)  --> friendsWaiting
        -- watchlist WHERE event_id IN (play events) AND user_id IN (friendIds) AND status='seen'
           JOIN profiles                                              --> friendsSeen
```

All three data-fetch phases run in parallel where possible. The friends effect fires after `allEvents` resolves (needs event IDs for the watchlist query).

---

### Build Order

Dependencies are strictly sequential between layers; within a layer, files can be built in parallel.

**Layer 1 (must complete first)**
- `supabase/migrations/20260813000001_play_interest.sql` — DB objects must exist before hooks can query them

**Layer 2 (after migration)**
- `src/lib/types.ts` additions
- `src/lib/emotions.ts` additions

**Layer 3 (after Layer 2)**
- `src/hooks/usePlayInterest.ts`
- `src/hooks/usePlaySpectrum.ts`

**Layer 4 (after Layer 2, parallel with Layer 3)**
- `src/components/play/PlayActionBar.tsx`
- `src/components/play/WaitingBlock.tsx`
- `src/components/play/PlaySpectrumBlock.tsx`
- `src/components/play/StagedProductionsBlock.tsx`
- `src/components/play/UnstagedBlock.tsx`
- `src/components/play/PlayPeopleBlock.tsx`

**Layer 5 (after Layers 3 + 4)**
- `src/pages/PlayDetail.tsx` upgrade

---

### Explicit Out-of-Scope Boundaries

These are in the design spec but excluded from this ticket to keep the change surface bounded:

- Notification delivery when a production is announced — schema supports it (`play_interest` + city), Edge Function is a separate ticket
- My Shows fourth shelf (PLAYS YOU'RE WAITING FOR) — `MyShows.tsx` is not touched here; schema supports it
- Production picker for "I'VE SEEN IT" — navigates to `/app/log` for now; full flow is a LogShow upgrade
- Adjacent show live query in `UnstagedBlock` — renders curated `adjacent_event_id` or playwright fallback; algorithmic discovery is future work
- `event_access` access chips on the production listing — not in the play-page spec (F60 is a separate ticket)
- `sale_notifications` table for "TELL ME WHEN ON SALE" — button logs intent only

---

## Appendix: Design Spec Acceptance Checklist

These map directly to the acceptance items in `PLAY-AND-WAITING.md §7`:

- [ ] `Want to see it` persists on a play with zero productions, survives reload, and appears in My Shows (FR1, FR3, FR12)
- [ ] Seeing a production does not silently clear the play interest (FR2)
- [ ] Waiting count and 8-bucket trend render on every play page, in both themes (FR5, FR6)
- [ ] Announcing a production notifies everyone waiting for that play in that city, once (OUT OF SCOPE — logged as separate feature)
- [ ] The unstaged page always offers a free local read and one adjacent thing that is actually on (FR9)
- [ ] YOUR PEOPLE renders fully within 844px — it is never the block that clips (FR10)
- [ ] Spectrum bars use `base()` from `emotions.ts`; labels use the light-theme color variant (FR7)
- [ ] No individual waiter is identifiable beyond the user's accepted friends (FR10, FR5)
