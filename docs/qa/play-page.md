# QA: Play Page (Frames 4a and 4b)

**Date:** 2026-08-13
**Scope:** `src/pages/PlayDetail.tsx`, `src/hooks/usePlayInterest.ts`, `src/lib/waiting.ts`, `supabase/migrations/20260813000001_play_interest.sql`, `src/pages/MyShows.tsx`
**Entry:** Navigate to `/app/play/:playId` (staged or unstaged play)
**PRD:** `.claude/docs/prd/play-page.md`
**ADR:** `docs/adr/0004-play-interest-primitive.md`
**Graph:** `docs/graphs/play-page.md`

---

## FR1 — Want to see it toggle

- [ ] Given a signed-in user on any play page, when the user taps "Want to see it," then the button label changes immediately to "You're waiting ✓" before the network write completes
- [ ] When the user is in "You're waiting ✓" state, the button shows `--accent-bg` background with `1.5px solid --accent` border and `--accent-text` text color
- [ ] When the user reloads the play page after toggling, the button renders as "You're waiting ✓" (state survived reload)
- [ ] When the user taps "You're waiting ✓," the button reverts to "Want to see it" default state immediately (toggle off)
- [ ] After toggling off and reloading, the button renders as "Want to see it" (delete persisted)
- [ ] The "Want to see it" button has `aria-pressed="false"` in default state
- [ ] The "Want to see it" button has `aria-pressed="true"` in waiting state
- [ ] The WAITING IN CHICAGO count increments by 1 immediately when the user toggles on <!-- qa:human count comparison requires two browser sessions or known baseline -->
- [ ] The WAITING IN CHICAGO count decrements by 1 immediately when the user toggles off

---

## FR2 — Want persists after logging a production

- [ ] Given a user who has toggled "Want to see it" for a play, when the user logs a production of that play as "seen" via the log flow, then the play page still renders "You're waiting ✓" after the log completes
- [ ] The `play_interest` row is NOT deleted when a `watchlist` row for the same play's event is upserted

---

## FR3 — Staged vs. unstaged detection

- [ ] Given a play with at least one Chicago event whose `end_date >= today`, the page renders in STAGED state: shows JUST ANNOUNCED section and SOMEONE ANNOUNCED IT footer in the waiting card
- [ ] Given a play with no Chicago events (or only events with `end_date < today`), the page renders in UNSTAGED state: shows 8-bar trend and UNTIL SOMEBODY STAGES IT section
- [ ] Given a play with only past Chicago events (all `end_date < today`), the page renders in UNSTAGED state (not STAGED)

---

## FR4 — Title block

- [ ] Play title renders in Newsreader italic at 31px <!-- qa:human visual font size check at 390px -->
- [ ] Playwright renders at 15px `--ink-dim`; year renders with `·` separator in `--ink-faint`
- [ ] If `plays.year_written` is null, no `·` separator or year appears
- [ ] If `plays.premise` is non-null, the premise renders with a 3px left border in `var(--accent-border)` and Newsreader italic 15.5px
- [ ] If `plays.premise` is null, no premise block appears (no empty bordered div)
- [ ] Award chips render when `plays.awards` is non-empty: Courier Prime 9px, uppercase, `--accent` color, bordered
- [ ] Award chips are absent when `plays.awards` is empty array

---

## FR5 — WAITING IN CHICAGO card

- [ ] The card renders with `1px solid --accent-border` border and `--accent-bg` background in light theme
- [ ] The label "WAITING IN CHICAGO" renders in Courier Prime 9.5px with `letter-spacing: 0.18em`
- [ ] The count right-aligns in JetBrains Mono 14px `--accent-text`
- [ ] A count of 0 renders as "0" without crashing
- [ ] An interpretation sentence rendered below the count (from `interpretWaitingCount`)

---

## FR6 — 8-bar monthly trend (UNSTAGED only)

- [ ] Given an unstaged play, 8 bars render inside the WAITING IN CHICAGO card in a 34px container
- [ ] Bars align to the bottom of the container (tallest bar touches top)
- [ ] The oldest bar is lighter (closest to `oklch(0.80 0.06 55)`) and the newest bar is `var(--accent)` <!-- qa:human color ramp check -->
- [ ] If only 3 months of data exist, only 3 bars render (no phantom zero bars)
- [ ] If no trend data exists, the bar section is absent and the card still renders with count and interpretation
- [ ] A trend interpretation sentence renders below the bars
- [ ] The 8-bar trend does NOT appear in STAGED state

---

## FR7 — EVERY ROOM spectrum

- [ ] Given a play with emotion data in `play_emotion_counts`, the EVERY ROOM section renders with a `SpectrumBar` at 11px height
- [ ] The top 3 emotions are labeled below the bar with their percentages
- [ ] An interpretation sentence renders below the labels (`InterpretationSentence` component)
- [ ] A total card count renders in Courier Prime 9.5px (e.g., "ACROSS 47 PEOPLE WHO SAW IT")
- [ ] If the play has no emotion data, the EVERY ROOM section is entirely absent (no empty bar renders)
- [ ] In STAGED state, the section label reads "EVERY ROOM, EVERY PRODUCTION"
- [ ] In UNSTAGED state, the section label reads "EVERY ROOM, EVERYWHERE"

---

## FR8 — JUST ANNOUNCED section (STAGED only)

- [ ] Given STAGED state, the venue name renders in Newsreader italic at 19px
- [ ] Date range renders in Courier Prime 10px `--accent-text` formatted as "MAR 7 – APR 4"
- [ ] When `events.cast_members` is null or empty, "casting not announced" renders in `--ink-faint` (never a blank field)
- [ ] When director is null, "director not announced" renders in `--ink-faint`
- [ ] "TELL ME WHEN ON SALE" button renders at 40px height with accent fill
- [ ] Tapping "TELL ME WHEN ON SALE" shows a toast confirming intent (does not crash)
- [ ] "SHARE" button renders at 72px width, outline style
- [ ] Tapping "SHARE" invokes `navigator.share()` with the play URL; on desktop, copies URL to clipboard and shows "Copied" toast <!-- qa:human mobile-only for navigator.share -->
- [ ] Past productions list below a dotted divider shows max 2 rows
- [ ] Past productions list is absent if no past Chicago productions exist

---

## FR9 — UNTIL SOMEBODY STAGES IT (UNSTAGED only)

- [ ] Given UNSTAGED state, the "UNTIL SOMEBODY STAGES IT" section always renders with exactly 2 rows
- [ ] Row 1 shows a library link: either `plays.library_url` or the catalog fallback URL
- [ ] "AT THE HAROLD WASHINGTON LIBRARY · FREE" renders in `var(--access)` green
- [ ] Tapping "FIND IT →" opens the library URL in a new browser tab
- [ ] Row 2 shows an adjacent event when `plays.adjacent_event_id` is non-null and the event's `end_date >= today`
- [ ] Row 2 falls back to a same-playwright current Chicago event when `adjacent_event_id` is null or expired
- [ ] Row 2 falls back to the Goodman website link when no playwright match exists
- [ ] The UNTIL section does NOT appear in STAGED state

---

## FR10 — YOUR PEOPLE section

- [ ] Given a user with no accepted friends who have seen or are waiting for the play, the YOUR PEOPLE section is entirely absent
- [ ] Given STAGED state with at least 1 accepted friend who has seen the play, a 34px circular avatar renders with the friend's username
- [ ] The friend's reflection quote renders in Newsreader italic 13.5px with a 2px left border
- [ ] If the friend has `share_reflections = false`, the quote shows "..." not their actual reflection text
- [ ] The summary line renders "0 OTHERS HAVE SEEN IT · 0 ARE WAITING" when only one friend has seen and none are waiting
- [ ] Given UNSTAGED state with at least 2 accepted friends in `play_interest`, overlapping 30px avatars render with `margin-left: -9px` gap from the second avatar <!-- qa:human visual check -->
- [ ] No pending friendship user appears in YOUR PEOPLE
- [ ] The YOUR PEOPLE section renders fully visible within a 390×844 viewport (does not clip below fold when it is the last section) <!-- qa:human scroll depth check on iPhone -->

---

## FR11 — I'VE SEEN IT button

- [ ] The "I'VE SEEN IT" button renders in every state (always visible, never disabled)
- [ ] Tapping "I'VE SEEN IT" on a STAGED play navigates to `/app/log/{currentEventId}`
- [ ] Tapping "I'VE SEEN IT" on an UNSTAGED play shows a toast explaining the log flow is coming (does not crash, does not navigate to a 404)

---

## FR12 — MyShows PLAYS YOU'RE WAITING FOR shelf

- [ ] Given a user with 0 `play_interest` rows, no "PLAYS YOU'RE WAITING FOR" section appears in the MyShows marquee view
- [ ] Given a user with 1+ `play_interest` rows, a "PLAYS YOU'RE WAITING FOR" section appears below the three existing shelves
- [ ] The section header shows the count right-aligned in JetBrains Mono 12px `--accent`
- [ ] Each play row shows title in Newsreader italic 17px, playwright in Courier Prime 10px `--ink-dim`
- [ ] A play with no current Chicago event shows "NOBODY'S STAGING IT" in Courier Prime 10px `--ink-ghost`
- [ ] A play with a current Chicago event shows "ANNOUNCED · MAR 2027" (or correct month/year) in Courier Prime 10px `--accent-text`
- [ ] Tapping a play row navigates to `/app/play/{playId}`
- [ ] The three existing MyShows shelves (Want to See, Tickets Booked, Seen) are unmodified

---

## Schema and Data Integrity

- [ ] Unauthenticated client cannot INSERT into `play_interest` (RLS blocks with 401)
- [ ] Authenticated user can only read/write their own `play_interest` rows (RLS blocks cross-user access)
- [ ] `play_waiting_counts` view is readable by anonymous users (aggregate counts, no user IDs)
- [ ] `play_waiting_trend` view returns rows ordered by month with correct counts
- [ ] Logging a play's production with emotions updates `play_emotion_counts` for that play_id within 1 trigger cycle
- [ ] Updating logged emotions updates `play_emotion_counts` weights correctly (not double-counted)
- [ ] Deleting a play deletes its `play_interest` rows (cascade) and `play_emotion_counts` rows (cascade)

---

## Regression Risks

- **Medium:** `MyShows.tsx` MarqueeView — verify that the three existing shelf cards (Want to See, Tickets Booked, Seen) are visually unchanged after the fourth shelf is added. Look for unwanted margin or spacing shifts.
- **Medium:** `event_emotion_counts` trigger — the new `play_emotion_counts` trigger fires on the same watchlist rows. Verify both triggers coexist without conflict. Check `event_emotion_counts` is still populated correctly after migration.
- **Low:** PlayDetail route (`/app/play/:playId`) — the URL and route are unchanged; verify navigation from `ProductionDetail.tsx` play-title tap still lands correctly.
- **Low:** `plays.adjacent_event_id` FK — if the referenced event is deleted, the FK is `on delete set null`. Verify the UNTIL section falls back gracefully when this column is null after a deletion.
