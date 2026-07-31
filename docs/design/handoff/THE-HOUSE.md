# THE-HOUSE.md — progression (replaces the belt system)

## What changed and why

The original AOA model used martial-arts belts (White → Black). It works, but it is borrowed from another culture and it reads as gamification: a colour you earn for doing chores.

**The House** uses theater's own vocabulary. You move from the back of the house toward the stage — Standing Room to Company. It means the same thing to a theater person as a belt means to a martial artist, and it says the thing AOA actually wants to say: *you are getting closer to the work.* It also lets progression celebrate access rather than consumption. Ushering — which is free, and which is how a broke twenty-three-year-old actually sees everything — is the fastest way up.

## The ladder

Seven ranks, stored as `house_rank smallint` 0–6, displayed to the user as `{rank + 1} OF 7`.

| # | Rank | Criteria (all required) | Unlocks |
|---|---|---|---|
| 0 | **Standing Room** | Sign up, finish onboarding (age range, city, experience, 3 interests) | Map, Tonight, venue pages, Want to See |
| 1 | **Balcony** | 1 show logged with feelings | Shelves, house spectrums, your palette, Seen count |
| 2 | **Mezzanine** | 3 shows across 2+ venues | Writing reviews, adding friends, the activity feed |
| 3 | **Orchestra** | 6 shows, 3+ venues, 3 written reflections | Recommendations ("because you were gutted by…"), advanced filters, play pages |
| 4 | **Front Row** | 12 shows in one season, 2+ kinds of room, **and** 1 opening night *or* 1 usher shift | Opening-night alerts, hidden-gem picks, following companies |
| 5 | **Green Room** | 5+ reviews, ushered twice, 2 friends who logged a show | Public curated lists, personal-note invitations |
| 6 | **Company** | 25+ shows over 2+ seasons, 8+ venues, sustained contribution (a review in each of the last 6 months) | Season planning, peer mentoring of Standing Room users, everything |

"Kinds of room" = `institutional` | `storefront` | `devised/experimental` | `school`.
A "season" runs September 1 → August 31.

## Non-negotiable rules

1. **No criterion costs money.** Ushering is free. Reflection is free. Pay-what-you-can nights count identically to $96 seats. If a future criterion would require spending, it does not ship.
2. **Ushering counts double.** One usher shift satisfies the Front Row alternative on its own. This is intentional: it is the cheapest door into the scene and it puts a newcomer inside a building with the company.
3. **No leaderboards. No comparison. No streaks. No decay.** Rank appears in exactly two places: the profile header, and a small badge on the reviews you write. Nowhere else — not in the feed, not on the map, not next to friends' names.
4. **Ranks never go down.** Not for inactivity, not ever. Somebody who saw forty shows in 2023 and none since is still Front Row.
5. **Social criteria start at Green Room (5).** A new user is never pressured to invite anyone.
6. **Every rank unlocks something real**, not a badge. If a rank has nothing to give, merge it.
7. **The next rank is always visible and always phrased as an invitation**, never as a requirement or a progress percentage. Copy pattern:
   `{what's left} and you're in the {next rank} — which unlocks {the genuinely good part}.`
   Example: *"Two more venues and one usher shift and you're in the Front Row — which unlocks opening nights and the good gossip."*

## Rendering

### Profile header
- Label `YOUR SEAT` (Courier Prime 9.5px, `letter-spacing:0.18em`, `#625b4c`)
- Rank name: Newsreader **italic** 20px, `oklch(0.84 0.13 55)`
- Counter `4 OF 7`: Courier Prime 9.5px `#4f4a3e`, right-aligned

### The seating chart
A 4-row abstraction of the house, not a literal map of seven ranks.

- Container: `border:1px solid #2b2720; border-radius:3px; background:#141109; padding:12px 0 10px`, flex column, `align-items:center`, `gap:5px`
- `STAGE` — Courier Prime 8.5px, `letter-spacing:0.3em`, `#4f4a3e`
- Stage edge: 180 × 2px, `background: oklch(0.42 0.09 55)`, `margin-bottom:8px`
- Four rows of eight 7px squares (`border-radius:1px`), `gap:4px`:
  - rows between the stage and the user: `oklch(0.55 0.11 55)`
  - the user's row: `oklch(0.45 0.09 55)`, with **one** seat at index 3 replaced by an 11px square, `border-radius:2px`, `background: oklch(0.86 0.15 55)`, `box-shadow: 0 0 10px oklch(0.80 0.14 55)`
  - rows behind the user: `#2b2720`
- `STANDING ROOM` — Courier Prime 8.5px, `letter-spacing:0.2em`, `#4f4a3e`, `margin-top:6px`

Row occupied by rank: `row = 3 - floor(rank * 3 / 6)` → ranks 0–1 sit in row 3 (back), 2–3 in row 2, 4–5 in row 1, 6 in row 0 (front).

### The ladder chips
All seven, wrapped, gap 6px, Courier Prime 10px, `padding:4px 9px`, `border-radius:2px`:
- **achieved:** `#4f4a3e`, `1px solid #211d17`, `text-decoration: line-through`
- **current:** `oklch(0.80 0.14 55)`, `1px solid oklch(0.42 0.09 55)`, `background oklch(0.20 0.04 55)`
- **future:** `#625b4c`, `1px dashed #2b2720`

Names render uppercase in chips (`STANDING ROOM`, `FRONT ROW`, `GREEN ROOM`, `COMPANY`) and title-case everywhere else.

### Review badge
Courier Prime 8.5px, `letter-spacing:0.1em`, `padding:1px 6px`, `border-radius:9px`.
Orchestra and above: gold text `oklch(0.80 0.14 55)` on `1px solid oklch(0.42 0.09 55)`.
Below Orchestra: `#9c9586` on `1px solid #2b2720`.
It is context, not authority — never sort or weight reviews by rank.

## The rank-up moment

Fires once, immediately after the log or review that satisfies the criteria, on top of whatever screen the user is on.

- Full-bleed `#0c0a05` with the gold gradient `linear-gradient(180deg, oklch(0.16 0.04 55), #0c0a05)`
- The seating chart, enlarged ~1.6×, centred
- The lit seat animates forward exactly one row: 400ms `cubic-bezier(.2,.8,.2,1)`, with the newly-vacated row fading from `oklch(0.45 0.09 55)` to `oklch(0.55 0.11 55)` over the same duration
- Rank name Newsreader italic 34px `oklch(0.84 0.13 55)`
- One line of copy, Newsreader 16px `#9c9586`. Written per rank, warm, specific, funny where it earns it:
  - Balcony: `That's one. The rest of your life in this city just got a little bigger.`
  - Mezzanine: `Three shows, two rooms. You're not a tourist anymore.`
  - Orchestra: `Six shows in. You have opinions now, and they're good ones.`
  - Front Row: `Opening nights are yours. Get there early; the lobby is the point.`
  - Green Room: `You bring people. That's the whole thing, really.`
  - Company: `Twenty-five shows, eight rooms, two seasons. You're part of this.`
- Dismiss by tapping anywhere. No confetti, no sound, no share prompt. Never shown twice.
- Under `prefers-reduced-motion`, the seat is simply drawn in its new position.

## Migration from belts

```sql
alter table profiles add column house_rank smallint not null default 0;
update profiles set house_rank = least(belt_level, 6);
alter table profiles drop column belt_level;
```

Delete `BELT_NAMES` and `BELT_COLORS` from `src/lib/types.ts` and every import of them (`Profile.tsx`, `ReviewCard.tsx`, `BeltUpgradeModal.tsx`, `useBeltCheck.ts`). Rename `useBeltCheck` → `useHouseCheck` and `BeltUpgradeModal` → `HouseRankModal`. Leaving belt code in place next to House code is the single most likely way this ships wrong.
