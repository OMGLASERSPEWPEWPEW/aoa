# Handoff: The Art of Art — House Record

**Feature:** Goodreads-style production tracker, emotion-based rating, House progression, and venue map for The Art of Art (`OMGLASERSPEWPEWPEW/aoa`).

**Target repo:** `OMGLASERSPEWPEWPEW/aoa` @ `main` — React 19 + TypeScript + Vite + Tailwind, Supabase (auth/Postgres/RLS), Mapbox GL JS installed, PWA via vite-plugin-pwa.

---

## 0. Read this first

### These files are design references, not production code
The HTML in this bundle is a **prototype**: it shows intended look, copy, and behavior. It is deliberately written with inline styles and hardcoded data. **Do not paste it into the app.** Recreate it in the existing codebase using its established patterns — React function components in `src/components/` and `src/pages/`, Tailwind utility classes, hooks in `src/hooks/`, types in `src/lib/types.ts`, Supabase queries via `src/lib/supabase.ts`.

### Fidelity: HIGH
Every colour, size, weight, letter-spacing, and copy string in this document is final and intentional. Match them exactly. Where this document gives a hex or an `oklch()` triplet, use that literal value — do not substitute a "close" Tailwind default (`slate-900` is not `#0c0a05`; `amber-400` is not `oklch(0.80 0.14 55)`).

### The three biggest fidelity risks — read before writing code
1. **Do not reintroduce star ratings.** Ratings are gone. Feelings replace them. Any `rating: number` you see in the current codebase is being retired (see §7).
2. **Do not reintroduce belts.** The martial-arts belt ladder is replaced by **The House** (§6). No belt colours, no belt names, no `BELT_NAMES`/`BELT_COLORS` in new code.
3. **Do not add a "Learn" tab.** It is cut from this design. Bottom navigation has exactly five slots (§2.3).

### What this design is for
AOA's thesis is that theater feels inaccessible because there is no curation layer, no social layer, and no visible progression for *audience members*. This feature set is the social + record layer: a person can keep what they've seen, say how it felt in a way that isn't a five-star verdict, see what their people saw, and find a curtain that is up tonight and affordable. Every screen should make theater look **alive and enterable**, never exclusive.

---

## 1. Files in this bundle

| File | What it is |
|---|---|
| `The Art of Art - House Record.dc.html` | Seven mobile screens on one pannable canvas: Tonight, My Shows A, My Shows B, Show detail, Log a show, Write a review, You, Discover |
| `The Art of Art - Map.html` | The Map screen — a working Leaflet prototype with real Chicago coordinates, custom markers, filters, and the venue sheet |
| `support.js`, `image-slot.js` | Runtime files for the prototypes only. **Not for the app.** |
| `DATA-MODEL.md` | Schema deltas against the current Supabase migrations |
| `EMOTIONS.md` | The canonical twelve feelings, exact colours, and every rule for rendering them |
| `THE-HOUSE.md` | The progression system that replaces belts |

Open the `.dc.html` in a browser to pan around all screens. Open `The Art of Art - Map.html` to interact with the map.

---

## 2. Global system

### 2.1 Frame
All screens are designed at **390 × 844** (iPhone 14/15 logical px). Mobile only — no desktop breakpoint in this pass.

Safe areas: 44px status area at top (the design draws its own status row at `padding:14px 26px 6px`, `font-family:JetBrains Mono`, `12px`, `#9c9586`), 22px home-indicator gutter at the bottom, already included in the tab bar's `padding-bottom:22px`.

### 2.2 Design tokens

**Colour — surfaces**
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0c0a05` | Page background, tab bar, sheet |
| `--bg-card` | `#141109` | Cards, inset panels, input wells |
| `--bg-chrome` | `#1a1610` | Browser/device chrome only |
| `--rule` | `#2b2720` | All 1px borders and dividers |
| `--rule-soft` | `#211d17` | List-row dividers (quieter than `--rule`) |

**Colour — ink**
| Token | Value | Use |
|---|---|---|
| `--ink` | `#ebe5d6` | Primary text, headlines |
| `--ink-dim` | `#9c9586` | Body copy, secondary text |
| `--ink-faint` | `#625b4c` | Labels, metadata, inactive tab icons |
| `--ink-ghost` | `#4f4a3e` | Footnotes, counts, disabled |
| `--ink-whisper` | `#3f3a31` | Attribution only |

**Colour — accent (gold)**
| Token | Value | Use |
|---|---|---|
| `--accent` | `oklch(0.80 0.14 55)` | Primary CTA fill, active tab, active underline, live values |
| `--accent-text` | `oklch(0.84 0.13 55)` | Gold text on dark when it must read larger |
| `--accent-border` | `oklch(0.42 0.09 55)` | Border of gold-tinted chips |
| `--accent-bg` | `oklch(0.20 0.04 55)` | Fill of gold-tinted chips |
| `--accent-deep` | `oklch(0.45 0.10 55)` | Avatar backgrounds |
| `--live` | `oklch(0.74 0.16 145)` | "Curtain up tonight" dot |
| `--access` | `oklch(0.68 0.13 150)` | Free / pay-what-you-can / usher — the accessibility green |

Gold gradient used on hero bands and the profile header:
`linear-gradient(180deg, oklch(0.16 0.04 55), #0c0a05)`

**Typography** — load from Google Fonts:
`Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500`, `Courier+Prime:wght@400;700`, `JetBrains+Mono:wght@400;500`

| Role | Family | Rules |
|---|---|---|
| Display / titles | **Newsreader**, Georgia, serif | `font-style: italic`, `font-weight: 400`. Every production title, play title, venue name, and screen title is italic Newsreader. This is the single strongest signature of the design. |
| Body | **Newsreader**, Georgia, serif | roman, 14–16px, `line-height: 1.45` |
| Labels / metadata / chips / nav | **Courier Prime**, monospace | uppercase, `letter-spacing` 0.06em–0.18em, 9–12px |
| Numbers / technical | **JetBrains Mono**, monospace | counts, dates in the ledger, status bar |

Type scale actually used (px): `8.5, 9, 9.5, 10, 10.5, 11, 12, 12.5, 13.5, 14, 14.5, 15, 16, 17.5, 18, 19, 20, 22, 23, 24, 26, 27, 29, 31`. Do not invent sizes between these.

Label convention: Courier Prime, `9.5px`, `letter-spacing: 0.18em`, `color: var(--ink-faint)`, uppercase. Used for every section header (`THE HOUSE FELT`, `YOUR PEOPLE WENT OUT`, `THE COMPANY`).

**Radius**
| Value | Use |
|---|---|
| `2px` | Tags, tiles, poster thumbnails, spectrum bars, seat squares |
| `3px` | Buttons, cards, panels, inputs |
| `9999px` | Emotion pills, filter chips, avatars, wheel nodes |
| `38px` | Device frame (prototype only) |
| `16px 16px 0 0` | Map bottom sheet |

**Elevation** — this design uses **rules, not shadows**. The only shadows: the device frame (prototype only) and the map sheet `0 -14px 44px rgba(0,0,0,.75)`. Do not add card shadows.

**Spacing** — horizontal page padding is `20px` everywhere. Section vertical padding `14–18px`. Gaps: `5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 24`.

**Touch targets** — no interactive element below **44px**. Primary buttons `46px`, footer CTAs `50px`, tab items `48px`, emotion wheel nodes `66px`.

### 2.3 Bottom navigation (all screens)

Container: `display:flex; border-top:1px solid #2b2720; background:#0c0a05; padding:8px 6px 22px;` → total height **79px**.

Five slots, each `flex:1; height:48px;` column-centred, `gap:3px`:

| Slot | Glyph | Label | Route |
|---|---|---|---|
| 1 | `◉` | `TONIGHT` | `/app` |
| 2 | `⌖` | `MAP` | `/app/map` |
| 3 | `✦` | *(none)* | Log-a-show entry |
| 4 | `▤` | `MY SHOWS` | `/app/watchlist` |
| 5 | `◇` | `YOU` | `/app/profile` |

Glyph `font-size:15px`. Label Courier Prime `9px`. Inactive `#625b4c`; active `oklch(0.80 0.14 55)`.

Slot 3 is not a tab — it is a 44×44 gold circle (`border-radius:50%`, background `oklch(0.80 0.14 55)`, glyph `✦` in Newsreader italic 19px, colour `#0c0a05`) that opens **Log a show**. It has no label and never shows an active state.

> On the Discover screen the `◎ DISCOVER` slot replaces `⌖ MAP` in slot 2 of the prototype. Ship the five above; Discover is reachable from search in the Tonight masthead. If the team prefers six destinations, replace slot 4 with a segmented control inside My Shows — do not add a sixth tab.

---

## 3. Screen specs

Copy strings below are **verbatim**. Curly apostrophes where shown.

### 3.1 Tonight — `src/pages/Tonight.tsx` (replaces the current `Discover` index route)

**Purpose:** answer "is there anything on tonight that I would like and can afford" in under ten seconds, then show that your people are out.

**Structure, top to bottom:**

1. **Masthead** — `padding:8px 20px 12px; border-bottom:1px solid #2b2720; display:flex; align-items:baseline; justify-content:space-between`.
   - `The Art of Art` — Courier Prime **700**, 19px, `letter-spacing:-0.01em`, `#ebe5d6`
   - `· chicago` — Courier Prime 10px, `#625b4c`
   - Right: notification glyph `◔`, 18px, `#9c9586`

2. **Marquee ticker** — full-bleed, `background: linear-gradient(180deg, oklch(0.16 0.04 55), #0c0a05)`, `border-bottom:1px solid #2b2720`, `overflow:hidden; white-space:nowrap`. Inner row `display:inline-flex; gap:28px; padding:9px 0`, Courier Prime 10.5px, `letter-spacing:0.14em`, colour `oklch(0.80 0.14 55)`, separators `·` in `#625b4c`.
   - Content: `47 CURTAINS UP TONIGHT` · `11 UNDER $20` · `3 OPENINGS` — **duplicated once** in the DOM so the loop is seamless.
   - Animation: `@keyframes` translateX 0 → -50%, `26s linear infinite`. Respect `prefers-reduced-motion: reduce` → no animation, show the first three items statically.
   - Numbers are live: count of tonight's performances in the user's city, count priced ≤ $20, count of opening nights.

3. **Hero production** — image band `height:196px`, full-bleed, `position:relative`.
   - Scrim: `position:absolute; inset:0; background:linear-gradient(180deg, rgba(12,10,5,0.1) 40%, rgba(12,10,5,0.96)); pointer-events:none`
   - Genre chips bottom-left at `left:20px; right:20px; bottom:12px`, gap 6px:
     - Primary genre chip: Courier Prime 9.5px, `letter-spacing:0.12em`, `padding:3px 8px`, `border-radius:2px`, text `oklch(0.82 0.15 90)`, background `oklch(0.22 0.05 90)` — **colour derived from genre hue**, see §3.1.1
     - Secondary chip: same metrics, `color:#9c9586`, `border:1px solid #2b2720`, no fill
   - Body block `padding:14px 20px 18px; border-bottom:1px solid #2b2720`:
     - Title: Newsreader italic 400, **29px**, `line-height:1.04`, `#ebe5d6`, margin-bottom 4px
     - Venue line: Courier Prime 10.5px, `letter-spacing:0.08em`, `#625b4c` — format `VENUE · SPACE · NEIGHBORHOOD`, e.g. `GOODMAN THEATRE · ALBERT · THE LOOP`
     - Blurb: Newsreader roman 15px, `line-height:1.45`, `#9c9586`. Play titles inside the blurb are italic.
     - **The house felt** block (see §4)
     - Actions row, gap 10px: `Want to see` — flex:1, height 46px, Newsreader italic 15px, `#0c0a05` on `oklch(0.80 0.14 55)`, radius 3px. Secondary: width 104px, height 46px, Courier Prime 11px, `#9c9586`, `border:1px solid #2b2720` — label is the real price signal, e.g. `$25 HOTTIX`.

4. **Your people went out** — `padding:16px 20px 14px; border-bottom:1px solid #2b2720`.
   - Label `YOUR PEOPLE WENT OUT`
   - Grid `40px 1fr`, gap 12px. Avatar 40px circle.
   - Sentence: Newsreader 14.5px, `line-height:1.35`. Friend name and production title **italic**, connective words (`saw`, `at Lookingglass`) in `#9c9586`.
   - Emotion pills row (see §4.3), margin `6px 0 7px`
   - Quote: Newsreader **italic** 13.5px, `line-height:1.45`, `#9c9586`, `border-left:2px solid #2b2720; padding-left:10px`. Quote is the first 90 characters of their reflection, wrapped in curly quotes, ellipsised on a word boundary.

5. **Free tonight** — `padding:16px 20px`.
   - Label `FREE TONIGHT` in `oklch(0.68 0.13 150)` + trailing `— NO CATCH, NO TICKET` in `#4f4a3e`
   - Body Newsreader 15px `line-height:1.4`; the initiative name italic `#ebe5d6`, rest `#9c9586`.
   - This section is **not optional**. If there is nothing free tonight, show the cheapest three instead under the label `CHEAPEST TONIGHT`. Never render an empty state here — accessibility is the product's promise.

#### 3.1.1 Genre hue map
Chip and cover colours derive from genre. `oklch(0.82 0.15 H)` for text, `oklch(0.22 0.05 H)` for fill.

| Genre | H |
|---|---|
| Musical / comedy | 90 |
| Drama / literary | 250 |
| Experimental / devised | 300 |
| Classic / Shakespeare | 55 |
| New work / premiere | 150 |
| Thriller | 25 |

### 3.2 My Shows — two takes

Both takes share: shelves are **Want to See**, **Tickets Booked**, **Seen**. Ship one; the other is the alternative.

#### Take A — "The Marquee" (`1a`)
Visual, poster-forward. Best for users with fewer than ~20 logged shows.

- Header `padding:8px 20px 14px; border-bottom:1px solid #2b2720`: `My Shows` Newsreader italic 26px; right `+ ADD A SHOW` Courier Prime 10.5px `#625b4c`.
- Content `padding:18px 20px 0`, three stacked cards, gap 14px.
- **Want to See** card: `border:1px solid #2b2720; border-radius:3px; background:#141109; padding:16px 16px 14px`. Title Newsreader italic 22px; count JetBrains Mono 12px in gold. Row of three 62×84 poster thumbs (radius 2px, `border:1px solid #2b2720`, each with a 4px full-height left spine in its genre hue), then a `+9` tile: `flex:1; height:84px; border:1px dashed #2b2720; radius 2px`, Courier Prime 11px `#4f4a3e`.
- **Tickets Booked** card is emphasised: `border:1px solid oklch(0.42 0.09 55)`, `background:linear-gradient(180deg, oklch(0.18 0.04 55), #141109)`. Each booking row: date block (Courier Prime 10px, `letter-spacing:0.1em`, two lines `FRI` / `8:00`, `border:1px solid`, radius 2px, padding `5px 7px`) — gold border + gold text for the next one, `#2b2720` + `#9c9586` after; then title Newsreader italic 17px and `VENUE · ROW J, SEAT 12` in Courier Prime 10px `#9c9586`. Rows divided by `1px dotted #2b2720`.
- **Seen** card: title + count, then `24 VENUES · 31 REFLECTIONS · 4 USHERED` in Courier Prime 10px `letter-spacing:0.06em` `#625b4c`, then label `YOUR PALETTE, ALL 87` and a **26px** palette bar (§4.2), then one sentence of plain-language insight in Newsreader 14px `#9c9586` with the two dominant feelings italic and in their own colours.
  - Insight copy pattern: `You are, statistically, a person who likes to be {top1} and then {top2}.` Generate from the top two feelings by count. Keep it observational and warm — never prescriptive, never a score.

#### Take B — "The Ledger" (`1b`)
Dense, chronological, month-grouped. Best for heavy users; this is what an 87-show person wants.

- Header: `My Shows` italic 26px + `SINCE 2021` JetBrains Mono 11px `#625b4c`.
- Segmented tabs, `display:flex; gap:24px; padding:0 20px; border-bottom:1px solid #2b2720`. Each: Courier Prime 12px, `padding:8px 0 12px`, `border-bottom:2px solid transparent`. Inactive `#625b4c` with count in `#4f4a3e`; active `#ebe5d6` with count in gold and `border-bottom-color: oklch(0.80 0.14 55)`.
  - Labels: `WANT TO SEE 12` · `BOOKED 3` · `SEEN 87`
- Month divider: `padding:12px 20px 10px; display:flex; align-items:center; gap:10px` — `JULY 2026` label, a `flex:1; height:1px; background:#2b2720` rule, then `4 SHOWS` in Courier Prime 9.5px `#4f4a3e`.
- Row: grid `34px 1fr auto`, gap 12px, `padding:11px 20px`, `border-bottom:1px solid #211d17`.
  - Day: JetBrains Mono 11px `#625b4c`, `padding-top:3px`, zero-padded (`03`)
  - Title Newsreader italic 17.5px `line-height:1.2`; venue line Courier Prime 10px `#625b4c` as `VENUE · NEIGHBORHOOD`
  - Optional excerpt: Newsreader italic 13.5px `#9c9586`, `margin-top:5px` — only when the user wrote a reflection, first ~80 chars
  - Optional badge inline after the title: `USHERED` — Courier Prime 8.5px, `letter-spacing:0.1em`, `color/border oklch(0.68 0.13 150)/oklch(0.36 0.07 150)`, `padding:1px 5px`, radius 9px
  - Right: the row's **emotion dots** — 9px circles, gap 3px, in the order the user picked them
- Empty shelf copy: `Nothing here yet.` / `Tap ✦ to log something you already saw — it counts, even from 2019.`

### 3.3 Show detail — `src/pages/ProductionDetail.tsx`

1. **Hero** `height:196px`, `flex:0 0 auto`. Scrim `linear-gradient(180deg, rgba(12,10,5,0.55) 0%, rgba(12,10,5,0.05) 40%, rgba(12,10,5,0.97))`. Back `←` and overflow `⋯` at `top:16px`, JetBrains Mono 12px, `#ebe5d6`.
   - **Do not** pull the title block up over the hero with a negative margin — it clips inside the scroll container. Title sits below the image; the scrim carries the transition.
2. **Title block** `padding:14px 20px 16px`
   - H1 Newsreader italic 400 **31px** `line-height:1.03`
   - Credit line Newsreader 15px `#9c9586`: `by {playwright} · directed by {director}` with the director's name italic `#ebe5d6`
   - Run line Courier Prime 10px `letter-spacing:0.08em` `#625b4c`: `VENUE · SPACE · THRU JUL 12 · $30–$96`
   - **Access chips**, gap 6px, wrap, margin-bottom 14px. Courier Prime 9.5px `letter-spacing:0.1em` `padding:3px 8px` radius 2px. The accessibility chip (`PAY-WHAT-YOU-CAN TUE`) uses `color oklch(0.68 0.13 150)` / `border 1px solid oklch(0.36 0.07 150)`; others `#9c9586` on `1px solid #2b2720`. Order: money first, then access services, then runtime.
   - Actions: `I'm going` (flex:1, 46px, gold, Newsreader italic 15px) + `WANT TO SEE` (flex:1, 46px, Courier Prime 11px, outline)
3. **The house felt** panel — `padding:14px 20px; border-top/bottom:1px solid #2b2720; background:#141109`. Label row with `198 CARDS` right-aligned in Courier Prime 9.5px `#4f4a3e`. Spectrum bar 11px (§4.2). Percentages row Courier Prime 10.5px, each in its feeling's colour, top three only. Then one sentence of Newsreader 14px `#9c9586` interpreting the shape — see §4.4.
4. **The company** — label `THE COMPANY`, row of 56px circular headshots with names in Newsreader 12.5px `#9c9586` below, and a trailing `+2 · ALL ENSEMBLE` in Courier Prime 10.5px `#4f4a3e`. Cap at three faces.
5. **What people said** — label + `WRITE ONE →` in Courier Prime 10px gold. Each review:
   - Name Newsreader italic 15px; **House rank badge** Courier Prime 8.5px `letter-spacing:0.1em` `padding:1px 6px` radius 9px — gold border/fill for Orchestra and above, `#9c9586`/`#2b2720` below; the writer's emotion dots (8px) right-aligned.
   - Body Newsreader 14.5px `line-height:1.45` `#9c9586`
   - Reviews divided by `1px dotted #2b2720`
   - Spoiler reviews collapse behind a tap target: `Contains spoilers — tap to reveal`, Courier Prime 11px, `color oklch(0.66 0.19 35)`, `background oklch(0.20 0.05 35)`, padding `6px 10px`, radius 2px, min-height 44px.
6. **Play vs production** — above the reviews, a one-line link when the work has other productions: `THE PLAY: Catch as Catch Can · 3 productions tracked →`, Courier Prime 10px `#625b4c`, tapping opens the play page (§3.7).

### 3.4 Log a show — the emotion wheel

Two steps. Step 1 is feelings; step 2 is words. **Step 2 is skippable and must stay skippable.**

- Header bar: `CANCEL` Courier Prime 11px `#9c9586` left; `STEP 1 OF 2` Courier Prime 10px `letter-spacing:0.16em` `#625b4c` right; `border-bottom:1px solid #2b2720`.
- Context: `TONIGHT, 8:00 · STEPPENWOLF` Courier Prime 10px `letter-spacing:0.14em` gold; title Newsreader italic 27px; prompt `So. What did it do to you?` Newsreader 15px `#9c9586`.
- **The wheel** — a 300×300 `position:relative` box, `margin:0 auto 6px`. Twelve 66px circular nodes on a 112px radius, first node at 12 o'clock, 30° apart clockwise. Exact `left/top` (top-left corner of each node), in clockwise order starting at 12:

  | # | Feeling | left | top |
  |---|---|---|---|
  | 0 | Delighted | 118 | 6 |
  | 1 | Electrified | 174 | 21 |
  | 2 | Furious | 215 | 62 |
  | 3 | Gutted | 230 | 118 |
  | 4 | Aching | 215 | 174 |
  | 5 | Cracked open | 174 | 215 |
  | 6 | Unsettled | 118 | 230 |
  | 7 | Transported | 62 | 215 |
  | 8 | Seen | 21 | 174 |
  | 9 | Held | 6 | 118 |
  | 10 | Buzzing | 21 | 62 |
  | 11 | Bored | 62 | 21 |

  Node, unselected: `border-radius:50%`, `border:1px solid #2b2720`, no fill, label Courier Prime 10px (9.5px and two lines for `Electri-fied`, `Cracked open`, `Trans-ported`, `Unsettled`), `line-height:1.2`, centred, text = the feeling's base colour. `Bored` text is `#625b4c`.
  Node, selected: `border:1.5px solid {base}`, `background: oklch(0.21 {C*0.3} {H})`, text `oklch({L+0.12} {C-0.03} {H})`.
  Centre of the wheel: `PICK UP<br>TO THREE`, Courier Prime 10px, `letter-spacing:0.1em`, `#4f4a3e`, `line-height:1.5`, in a 108px-wide box at `left:96px; top:112px`.
- **Selection rule:** minimum 1, maximum 3. Tapping a fourth does nothing except a 120ms shake on the centre label; do not silently swap. Selection order is preserved and is the order dots render everywhere else.
- **Selected row** below the wheel: `SELECTED` Courier Prime 9.5px `#4f4a3e` + one 10px dot per pick, gap 6px, centred.
- **How loud was the room?** — label, then three equal buttons, height 46px, gap 8px, Courier Prime 10.5px, radius 3px: `A MURMUR` / `REAL APPLAUSE` / `EVERYONE STOOD`. Unselected `#9c9586` on `1px solid #2b2720`; selected gold text on `oklch(0.20 0.04 55)` with `1.5px solid oklch(0.80 0.14 55)`. Optional — the user can continue without answering.
- Footer CTA: `Next — say a little more →`, full width, height 50px, gold, Newsreader italic 16px, `border-top:1px solid #2b2720`, `padding:14px 20px 26px`.
- Logging a show sets shelf status to `seen` and stamps `seen_date`. If the production was on the Booked shelf, clear the booking.

### 3.5 Write a review

- Header: `← BACK` / `STEP 2 OF 2`.
- The chosen emotion pills at top (§4.3) with a trailing `edit` in Courier Prime 9.5px `#4f4a3e` that returns to step 1.
- Label `PICK A PROMPT, OR JUST TALK`, then three prompt chips, Courier Prime 10.5px, `padding:6px 11px`, radius 14px. Selected = gold fill, `#0c0a05` text. Prompts, verbatim: `What surprised you?` · `One image you'll keep` · `Who should go?`
- Editor: `border:1px solid #2b2720; border-radius:3px; background:#141109; padding:16px; min-height:236px`. The chosen prompt is echoed inside in Courier Prime 10px `letter-spacing:0.12em` gold, then the text in Newsreader **16px** `line-height:1.55` `#ebe5d6`. Caret is a gold `▍`.
- Below: spoiler toggle — 38×22 track, radius 11, `#2b2720`, 18px knob `#625b4c` at `left:2px`; on = track `oklch(0.20 0.04 55)`, knob gold at `right:2px`, 160ms ease. Label `CONTAINS SPOILERS` Courier Prime 10.5px `#9c9586`. Character count right, JetBrains Mono 10.5px `#4f4a3e`. No maximum length.
- Privacy note, above the footer, `border-top:1px dotted #2b2720`, Newsreader 13.5px `#625b4c`: `Goes on your record and to your people. Steppenwolf sees the count, never your name.` — substitute the real venue name. This line is a promise; if the app ever shares identity with venues, change the product, not the copy.
- Footer: `JUST LOG IT` (96px, outline) + `Post to the house` (flex:1, gold, Newsreader italic 16px), both 50px.

### 3.6 You — `src/pages/Profile.tsx`

1. **Header** on the gold gradient, `padding:14px 20px 18px; border-bottom:1px solid #2b2720`.
   - 54px circular avatar + name Newsreader italic 23px + `CHICAGO · SINCE MARCH 2021` Courier Prime 10px `letter-spacing:0.08em` `#625b4c`
   - Rank row: `YOUR SEAT` label + rank name Newsreader italic 20px `oklch(0.84 0.13 55)` + `4 OF 7` Courier Prime 9.5px `#4f4a3e` right
   - **Seating chart** — `border:1px solid #2b2720; radius 3px; background:#141109; padding:12px 0 10px`, column-centred, gap 5px:
     - `STAGE` Courier Prime 8.5px `letter-spacing:0.3em` `#4f4a3e`
     - A 180×2px bar in `oklch(0.42 0.09 55)`, margin-bottom 8px
     - Four rows of eight 7px squares (`border-radius:1px`), gap 4px. Rows nearer the stage than the user: `oklch(0.55 0.11 55)`. The user's own row: `oklch(0.45 0.09 55)` with **their seat** an 11px square in `oklch(0.86 0.15 55)` and `box-shadow:0 0 10px oklch(0.80 0.14 55)`. Rows behind: `#2b2720`.
     - `STANDING ROOM` Courier Prime 8.5px `letter-spacing:0.2em` `#4f4a3e` at the back
     - The lit seat's row index = rank index counted from the stage. Rank 0 sits in the last row; rank 6 sits front row centre.
   - Next-step sentence, Newsreader 14.5px `#9c9586`, with the next rank italic `#ebe5d6`. Pattern: `{what's left} and you're in the {next rank} — which unlocks {the good part}.` Never phrase it as a requirement or a score.
2. **Stat strip** — four equal cells, `padding:14px 0`, dividers `1px solid #2b2720`. Value Newsreader italic 24px; label Courier Prime 9px `letter-spacing:0.1em` `#625b4c`. `SHOWS` / `VENUES` / `WROTE` / `USHERED` — the ushered value is `oklch(0.68 0.13 150)`, always, even at zero.
3. **Your palette this season** — label, 30px palette bar, then one insight sentence with a gentle, non-judgmental nudge. Example: `Mostly unsettled. You've been going to a lot of storefront. Maybe see something joyful before October.`
4. **The House** — label, then all seven ranks as chips, wrap, gap 6px, Courier Prime 10px, `padding:4px 9px`, radius 2px:
   - achieved: `#4f4a3e` on `1px solid #211d17`, `text-decoration: line-through`
   - current: gold text, `1px solid oklch(0.42 0.09 55)`, `background oklch(0.20 0.04 55)`
   - future: `#625b4c` on `1px dashed #2b2720`

### 3.7 Discover

- Search field: 46px, `border:1px solid #2b2720; radius 3px; background:#141109; padding:0 14px`, glyph `⌕` `#625b4c`, placeholder Newsreader **italic** 15px `#4f4a3e`: `A play, a theater, a feeling…` — searching by feeling is a real query; wire it to the emotion index.
- Filter chips, horizontal scroll, gap 6px: `TONIGHT` (active, gold fill) · `UNDER $20` (`oklch(0.74 0.12 150)` text on `1px solid oklch(0.36 0.07 150)`) · `STOREFRONT` · `ASL`. Courier Prime 10px, `padding:6px 11px`, radius 14px.
- **The play, not the poster** — label `THE PLAY, NOT THE POSTER`, then a work-level card: play title Newsreader italic 20px, `{playwright} · {award}, {year}` Newsreader 14px `#9c9586`, then one row per production separated by `1px dotted #2b2720`: date/year (gold if upcoming, `#625b4c` if past), venue, and right-aligned director in Courier Prime 10px `#625b4c` — or `YOU SAW THIS` in `#4f4a3e` if it's in the user's record.
- **The scene right now** — label with a 6px `oklch(0.74 0.16 145)` live dot. Three news items, each: kicker (Courier Prime 9.5px `letter-spacing:0.12em`, coloured by kind — `SEASON DROP` gold, `FREE` `oklch(0.68 0.13 150)`, `CLOSING SOON` `oklch(0.58 0.16 300)`), headline Newsreader italic 18px `line-height:1.2`, dek Newsreader 14px `#9c9586`. Divided by `1px solid #211d17`.
  - This is an editorial surface. Source it from a curated feed, not an algorithm. Three items, never more on this screen.

### 3.8 Map — see `The Art of Art - Map.html`

**Use Leaflet + OpenStreetMap** as prototyped, or Mapbox GL (already installed, `VITE_MAPBOX_TOKEN`) if the team prefers — but reproduce the visual result exactly.

- **Basemap tint:** `.leaflet-tile-pane { filter: grayscale(1) invert(1) brightness(.62) contrast(1.08) sepia(.55) hue-rotate(-8deg); }`. With Mapbox, use a custom dark style matched to `#0c0a05` land, `#2b2720` roads, `#625b4c` labels instead of a CSS filter.
- **Attribution is mandatory.** `© OpenStreetMap contributors` must be visible at all times. In the prototype it lives in the sheet's grab row (Courier Prime 8px `#3f3a31`) because the sheet overlays the map. Keep it visible in whatever layout ships.
- **Markers.** 34×40 hit area. A 30×30 chip, `border-radius:4px`, `background:#141109`, `border:1.5px solid`, `box-shadow:0 3px 8px rgba(0,0,0,.7)`, plus a 6px rotated square tail at `left:12px; top:29px`. The chip carries a glyph for the kind of room:
  - `▣` institutional · `▨` storefront · `◈` devised/experimental
  Border encodes the user's relationship:
  - **booked** — solid gold fill `oklch(0.80 0.14 55)`, glyph `#0c0a05`
  - **want to see** — `1.5px dashed oklch(0.80 0.14 55)`, glyph gold
  - **seen** — `1.5px solid {their dominant feeling there}`, glyph same colour, plus an 8px dot of that colour at the top-left corner
  - **never been** — `1.5px solid #2b2720`, glyph `#9c9586`
  A 9px `oklch(0.74 0.16 145)` dot with a 2px `#0c0a05` ring at the top-right means **curtain up tonight**, `1.8s` opacity pulse (suppress under reduced-motion).
  Selected marker: `transform: scale(1.18)`, `box-shadow: 0 0 0 5px rgba(212,164,86,.18), 0 4px 12px rgba(0,0,0,.8)`, 120ms.
  Filtered-out markers **dim to `opacity:.22`** — they are never removed. Keeping the shape of the city visible is the point.
- **Filter chips** float over the map at `top:10px`, `padding:0 14px`, horizontally scrollable, `backdrop-filter: blur(6px)`, `background: rgba(12,10,5,.9)`: `TONIGHT` · `UNDER $20` · `STOREFRONT` · `USHER SLOTS` · `NEVER BEEN`. Chips are **additive (AND)**.
- **The key** — a legend card bottom-left of the map, `rgba(12,10,5,.9)`, `1px solid #2b2720`, radius 3px, `padding:9px 11px`, `backdrop-filter: blur(6px)`. Courier Prime 9.5px `#9c9586`. Five lines, verbatim: `you have tickets` · `want to see` · `been — your colour` · `curtain up tonight` · `▣ house · ▨ storefront · ◈ devised`.
- **The sheet.** Anchored `bottom: 79px` (rests on the tab bar), `left/right:0`, `border-radius:16px 16px 0 0`, `border-top:1px solid #2b2720`, `background:#0c0a05`, `box-shadow:0 -14px 44px rgba(0,0,0,.75)`, `z-index:1100` (above Leaflet's controls). Grab handle 38×4, radius 2, `#2b2720`.
  - **Peek state** (nothing selected): headline Newsreader italic 19px — `14 curtains up within three miles` — and a Courier Prime label — `TAP A THEATER · 4 UNDER $20 · 2 PAY-WHAT-YOU-CAN`. Both live values.
  - **Detail state** (marker tapped), in order:
    1. 88×66 venue photo + name (Newsreader italic 22px) + `NEIGHBORHOOD · KIND · $$` (Courier Prime label) + your history line in Courier Prime 10px `#4f4a3e`, e.g. `YOU'VE BEEN 9 TIMES · LAST: JUL 3` or `NEVER BEEN — GOOD FIRST ONE`
    2. Tonight panel — `border:1px solid #2b2720; radius 3px; background:#141109; padding:13px 14px`. Live dot + `ON STAGE TONIGHT, 7:30` (or `DARK TONIGHT`, dot `#4f4a3e`). Production title italic 19px, credit line 14px `#9c9586`, then an 8px house-spectrum bar and the top two feelings with percentages.
    3. Fact chips — first chip is the **actionable** one and is gold-tinted (`YOU HAVE ROW H, SEAT 4`, `MARA SAW IT TUESDAY`, `PAY-WHAT-YOU-CAN TUE`); the rest are outline. Two to three chips.
    4. Actions: primary gold `I'm going` / `Get a ticket` / `You're going ✓` / `See the calendar` depending on state; `WANT TO SEE` outline; a 56px `↗` directions button.
    5. `ALSO WITHIN A TEN-MINUTE WALK` — the two nearest venues, each a tappable row: `UP`/`DARK` status in Courier Prime 10px (green/`#4f4a3e`), production title Newsreader italic 15px, venue name right-aligned Courier Prime 9.5px `#625b4c`.
  - Tapping the map background returns to peek. Selecting a marker pans the map to it.

---

## 4. The house felt — the emotion system

Full colour table and rules: `EMOTIONS.md`. Summary of the rendering contract:

### 4.1 The set
Exactly twelve, fixed, never user-extensible: **Delighted, Electrified, Furious, Gutted, Aching, Cracked open, Unsettled, Transported, Seen, Held, Buzzing, Bored.**

`Bored` is a first-class feeling with a deliberately neutral colour. Do not hide it, sort it last, or treat it as negative. Honest indifference is what makes the rest trustworthy.

### 4.2 The spectrum bar
`display:flex; gap:1px; border-radius:{h/2}px; overflow:hidden`. One `<span>` per feeling with `flex: {percentage}` and `background: {base colour}`, sorted descending. Heights by context: **8px** map sheet, **9px** Tonight hero, **11px** show detail, **26px** My Shows card, **30px** profile. Cap at seven segments; fold the tail into the last one.

Below the bar, name the top two or three with their percentages, Courier Prime 10.5px, each in its own colour.

### 4.3 Pills and dots
- **Pill** (a person's picks): Courier Prime 9.5px, `padding:2px 7px` (or `3px 9px` at larger size), `border-radius:9–10px`, `border:1px solid oklch(0.36 {C*0.5} {H})`, `background: oklch(0.21 {C*0.3} {H})`, text `oklch({L+0.10} {C-0.02} {H})`.
- **Dot** (compact lists, ledger rows, review headers, markers): a circle of the base colour, 8px in review headers, 9px in ledger rows, 10px in the selected row, gap 3px, **in the user's selection order**.

### 4.4 Interpretation copy
Every spectrum gets one sentence of plain English underneath. Rules: warm, specific, never a verdict, never a number restated. Good: *"A divisive one — people either fell all the way in or spent the drive home arguing."* Bad: *"Rated 3.8/5 by 198 users."*

Generate from shape, not from a single value:
- one feeling > 40% → *"The room agreed."*
- top two within 6 points and emotionally opposed → *"A divisive one."*
- `Bored` in the top three → *"Some people checked out. Ask a friend who liked it first."*
- top feeling is `Held` or `Seen` → *"People felt taken care of in there."*

---

## 5. Interactions, motion, and states

| Interaction | Behaviour |
|---|---|
| Tap a production card | Push Show detail. No modal — modals lose scroll position on back. |
| `Want to see` | Optimistic; button becomes `ON YOUR LIST` (outline, `#9c9586`) in 120ms. Failure reverts with a Courier Prime toast. |
| `I'm going` | Opens ticket link externally *and* sets shelf to `booked`. Both, always. |
| Log a show (`✦`) | Sheet from the bottom, 300ms `cubic-bezier(.2,.8,.2,1)`. If the user has a booking whose date has passed, pre-fill it and skip search. |
| Emotion node tap | 120ms fill/border transition. Haptic `selection` on native. Fourth pick: 120ms shake on the centre label, no state change. |
| Prompt chip | Swapping prompts never clears typed text. |
| Marquee | 26s linear infinite; paused under reduced-motion. |
| Live dot | 1.8s opacity pulse; static under reduced-motion. |
| Map marker tap | Sheet peek → detail, no transform animation needed (bottom-anchored); map pans to the marker. |
| Filter chip | Toggles; markers cross-fade opacity 120ms. Counts in the header and peek line update immediately. |
| Pull to refresh | Tonight and My Shows only. |

**Reduced motion:** disable the marquee, the live-dot pulse, and the sheet slide. Never disable state changes.

**Loading:** skeletons in `#141109` with a 1.4s shimmer to `#1a1610`. Never a spinner on a full screen. The Tonight hero reserves its 196px band so the layout does not jump.

**Empty states** (verbatim):
- Want to See: `Nothing on the list yet.` / `The map knows what's up tonight. Start there.`
- Seen: `Your record starts whenever you say it does.` / `Log something you saw in 2019 — it counts.`
- No friends: `Nobody here yet.` / `Theater is better with one other person. Bring one.`
- Search, no results: `Nothing under that name.` / `Try a feeling instead — "gutted", "delighted".`

**Errors:** inline, Courier Prime 10.5px, `oklch(0.66 0.19 35)`. Never a modal. A failed log is queued offline (Dexie is already in the stack) and retried — losing someone's reflection is the worst failure this app can have.

---

## 6. The House — progression (replaces belts)

Full detail: `THE-HOUSE.md`. Seven ranks, index 0–6, displayed as `{index+1} OF 7`:

| # | Rank | Earned by | Unlocks |
|---|---|---|---|
| 0 | Standing Room | Sign up, finish onboarding | Map, tonight feed, want-to-see list |
| 1 | Balcony | 1 show logged with feelings | Shelves, house spectrums, your palette |
| 2 | Mezzanine | 3 shows across 2+ venues | Writing reviews, friends, activity feed |
| 3 | Orchestra | 6 shows, 3+ venues, 3 written reflections | Recommendations, advanced filters, play pages |
| 4 | Front Row | 12 shows in a season, 2+ kinds of room, 1 opening night **or** 1 usher shift | Opening-night alerts, hidden-gem picks, follow companies |
| 5 | Green Room | 5+ reviews, ushered twice, 2 friends who logged a show | Curated public lists, invite with a personal note |
| 6 | Company | 25+ shows over 2+ seasons, 8+ venues, sustained contribution | Season planning, peer mentoring, everything |

Rules that must survive implementation:
- **No criterion costs money.** Ushering is free and counts twice as hard on purpose.
- **No leaderboards, no comparison, no streaks.** Ranks appear on your profile and as a small badge on your reviews. Nowhere else.
- **Ranks never go down.**
- Rank-up is a full-screen moment, once, with the seating chart animating your seat forward one row (400ms, `cubic-bezier(.2,.8,.2,1)`) and a single line of copy. Dismissible by tapping anywhere. Never repeat it.

---

## 7. Data model

Full DDL and migration notes: `DATA-MODEL.md`. Headlines:

- `profiles.belt_level` → **`house_rank` smallint 0–6**. Migrate `belt_level` values 1:1 (they are both 0–7 ladders; clamp 7 → 6).
- `watchlist.status` enum `'want_to_see' | 'seeing' | 'seen'` → **`'want_to_see' | 'booked' | 'seen'`**. Rename `seeing` → `booked`.
- `watchlist.rating smallint` → **drop**. Add `emotions text[]` (1–3 slugs, ordered) and `room_volume text` (`murmur|applause|standing`, nullable).
- `reviews.rating smallint` → **drop**. Add `emotions text[]`, `prompt text` (nullable slug).
- New `plays` table (work-level: title, playwright, year, awards) with `events.play_id` FK — a play has many productions. This is the thing theater has that books don't; the design leans on it in Discover and Show detail.
- New `venue_access` fields: `pay_what_you_can_days text[]`, `asl_dates date[]`, `usher_slots int`, `student_rush_price numeric`, `seat_count int`, `relaxed_performance_dates date[]`. These drive the green access chips and the `USHER SLOTS` map filter, and they are the most product-critical fields in the schema — AOA's whole promise is that theater is enterable.
- Denormalised counters stay as they are (`shows_seen_count`, `venues_visited_count`, `reviews_written_count`), plus `ushered_count` promoted from `user_progress.ushering_count` for cheap profile reads.
- Emotion aggregates: a materialised view or trigger-maintained `event_emotion_counts(event_id, emotion, count)` — the spectrum bar must not compute client-side over every card.

---

## 8. Assets

- **Fonts:** Google Fonts — Newsreader, Courier Prime, JetBrains Mono. Self-host for the PWA.
- **Photography:** production stills and headshots are placeholders in the prototype (drag-and-drop slots / hatched fills). Real images come from venue press kits — they require credit lines. Budget a `photo_credit text` column and render it in Courier Prime 8px `#3f3a31` at the bottom-left of hero images.
- **Icons:** the design uses typographic glyphs (`◉ ⌖ ✦ ▤ ◇ ◔ ⌕ ▣ ▨ ◈ ↗ ←`), not an icon library. Keep it that way — it is a large part of the editorial feel and it removes a dependency. If any glyph renders inconsistently on Android, replace **all** of them with one consistent stroke-icon set rather than mixing.
- **Map tiles:** OpenStreetMap via `tile.openstreetmap.org` (attribution required) or the existing Mapbox token.
- **No emoji anywhere.**

---

## 9. Acceptance checklist

Ship blockers. Check each against the prototype at 390×844.

**Type & colour**
- [ ] Every production, play, and venue title renders in Newsreader **italic**
- [ ] Every uppercase label is Courier Prime with `letter-spacing` ≥ 0.06em
- [ ] Page background is exactly `#0c0a05`; cards `#141109`; rules `#2b2720`
- [ ] Gold is `oklch(0.80 0.14 55)` everywhere — no `amber-400`
- [ ] No card shadows anywhere except the map sheet
- [ ] No text below 9px; no body copy below 13.5px

**The emotion system**
- [ ] Twelve feelings, exact names and colours from `EMOTIONS.md`
- [ ] Max three picks, order preserved, order respected in every dot row
- [ ] Spectrum bars use `gap:1px` and sort descending
- [ ] Every spectrum has one sentence of interpretation beneath it
- [ ] `Bored` is present, selectable, and never styled as a failure
- [ ] No star, number, or /5 appears anywhere in the UI

**The House**
- [ ] Seven ranks with the exact names in §6
- [ ] Rank badge appears only on profile and review headers
- [ ] No leaderboard, no comparison, no streak
- [ ] Seating chart lights exactly one seat, at the correct row

**Shelves**
- [ ] Exactly three: Want to See, Tickets Booked, Seen
- [ ] Logging a show moves it to Seen and clears any booking
- [ ] Empty states use the copy in §5

**Map**
- [ ] Markers show room-kind glyph, relationship border, and tonight dot
- [ ] Filters dim rather than remove
- [ ] Sheet sits above map controls and never covers the tab bar
- [ ] `© OpenStreetMap contributors` visible in every state
- [ ] Basemap reads: streets, the river, and neighborhood labels legible

**Access (the product promise)**
- [ ] Price appears on every production card and in every marker sheet
- [ ] Pay-what-you-can / free / usher-slot information is green `oklch(0.68 0.13 150)` and never buried below the fold
- [ ] Tonight's "free" section never renders empty
- [ ] Every touch target ≥ 44px

**Do not**
- [ ] No star ratings, no belts, no Learn tab, no emoji, no sixth bottom tab, no gradient backgrounds beyond the two specified gold gradients, no rounded-card-with-left-accent-border pattern

---

## 10. Suggested build order

1. Schema migration + `EMOTIONS.md` constants file + `THE-HOUSE.md` rank table in `src/lib/`
2. Log a show (the wheel) — it produces all the data everything else renders
3. My Shows, take B (the ledger) — cheapest surface to verify the data is right
4. Show detail + the spectrum component
5. Tonight
6. Map
7. You / profile + rank-up moment
8. Discover + play pages
