# EMOTIONS.md — the twelve feelings

The rating system. There are no stars in this product. A person picks **one to three** feelings after a show, in order, and optionally says how loud the room was. Everything else — the spectrum bar, the palette, the search-by-feeling, the taste profile — is derived from that.

## Why

A five-star average tells you a show is a 3.8 and tells you nothing about whether *you* should go. "31% unsettled, 24% held, 18% gutted" tells you exactly what kind of night it is. It also lets a person be honest without being cruel: `Bored` is a colour, not a one-star review of somebody's year of work. That matters in a small scene where the actors read everything.

## The canonical set

Fixed. Twelve. Not user-extensible, not localisable into a different set without redesigning the wheel. Order below is the wheel's clockwise order starting at 12 o'clock.

| # | Slug | Display | Base colour (oklch) | Hex fallback | Notes |
|---|---|---|---|---|---|
| 0 | `delighted` | Delighted | `oklch(0.82 0.15 90)` | `#e0b74a` | |
| 1 | `electrified` | Electrified | `oklch(0.80 0.15 60)` | `#e5a95c` | 2 lines on the wheel: `Electri-` / `fied` |
| 2 | `furious` | Furious | `oklch(0.66 0.19 35)` | `#cf6a45` | Also the error colour |
| 3 | `gutted` | Gutted | `oklch(0.62 0.19 18)` | `#c25a5b` | |
| 4 | `aching` | Aching | `oklch(0.58 0.12 330)` | `#a06a92` | |
| 5 | `cracked_open` | Cracked open | `oklch(0.64 0.18 350)` | `#c2648c` | 2 lines: `Cracked` / `open` |
| 6 | `unsettled` | Unsettled | `oklch(0.58 0.16 300)` | `#9066bb` | |
| 7 | `transported` | Transported | `oklch(0.60 0.14 255)` | `#6b81c4` | 2 lines: `Trans-` / `ported` |
| 8 | `seen` | Seen | `oklch(0.66 0.12 195)` | `#4fa4ab` | "someone put my life on stage" |
| 9 | `held` | Held | `oklch(0.68 0.13 150)` | `#54ab7f` | |
| 10 | `buzzing` | Buzzing | `oklch(0.76 0.16 120)` | `#8dc154` | |
| 11 | `bored` | Bored | `oklch(0.55 0.02 80)` | `#807b70` | Deliberately neutral, deliberately present |

Prefer the `oklch()` values. The hex column exists only for contexts that cannot parse oklch (email, older Android WebView).

## Derived styles

Given a feeling with base `oklch(L C H)`:

| Variant | Formula | Example (`unsettled`, L .58 C .16 H 300) |
|---|---|---|
| Bar segment / dot | base | `oklch(0.58 0.16 300)` |
| Pill background | `oklch(0.21 {C*0.3} {H})` | `oklch(0.21 0.048 300)` |
| Pill border | `oklch(0.36 {C*0.5} {H})` | `oklch(0.36 0.08 300)` |
| Pill / selected text | `oklch({L+0.12} {C-0.03} {H})` | `oklch(0.70 0.13 300)` |
| Selected wheel node border | `1.5px solid` base | |
| Selected wheel node fill | `oklch(0.21 {C*0.3} {H})` | |

`bored` has near-zero chroma, so its pill reads as a grey chip — correct and intended.

Ship these as a constants module, not as Tailwind classes (arbitrary oklch values in class strings are unreadable and get "helpfully" rounded):

```ts
// src/lib/emotions.ts
export const EMOTIONS = [
  { slug: 'delighted',    label: 'Delighted',    l: 0.82, c: 0.15, h: 90  },
  { slug: 'electrified',  label: 'Electrified',  l: 0.80, c: 0.15, h: 60  },
  { slug: 'furious',      label: 'Furious',      l: 0.66, c: 0.19, h: 35  },
  { slug: 'gutted',       label: 'Gutted',       l: 0.62, c: 0.19, h: 18  },
  { slug: 'aching',       label: 'Aching',       l: 0.58, c: 0.12, h: 330 },
  { slug: 'cracked_open', label: 'Cracked open', l: 0.64, c: 0.18, h: 350 },
  { slug: 'unsettled',    label: 'Unsettled',    l: 0.58, c: 0.16, h: 300 },
  { slug: 'transported',  label: 'Transported',  l: 0.60, c: 0.14, h: 255 },
  { slug: 'seen',         label: 'Seen',         l: 0.66, c: 0.12, h: 195 },
  { slug: 'held',         label: 'Held',         l: 0.68, c: 0.13, h: 150 },
  { slug: 'buzzing',      label: 'Buzzing',      l: 0.76, c: 0.16, h: 120 },
  { slug: 'bored',        label: 'Bored',        l: 0.55, c: 0.02, h: 80  },
] as const

export const base   = (e) => `oklch(${e.l} ${e.c} ${e.h})`
export const fill   = (e) => `oklch(0.21 ${(e.c * 0.3).toFixed(3)} ${e.h})`
export const edge   = (e) => `oklch(0.36 ${(e.c * 0.5).toFixed(3)} ${e.h})`
export const bright = (e) => `oklch(${(e.l + 0.12).toFixed(2)} ${(e.c - 0.03).toFixed(2)} ${e.h})`
```

The wheel's clockwise order **is** array order. Do not sort it alphabetically or by valence — the layout depends on index.

## Rules

1. **One to three picks.** Minimum one, maximum three. A fourth tap is rejected with a 120ms shake on the wheel's centre label. Never silently swap out an earlier pick.
2. **Order is meaningful and preserved.** The first pick is the dominant feeling. Dots render in pick order everywhere; the first pick is what colours a "seen" map marker and the ledger's leading dot.
3. **No valence, no scoring.** Never map feelings to a number, a sentiment score, or a thumbs up/down. `Furious` at a play about injustice is a rave. Do not compute an average.
4. **`Bored` is never hidden.** It appears in the wheel, in spectrums, in a person's palette. Do not sort it last, grey it out beyond its own colour, or exclude it from "top feelings".
5. **Community aggregate = share of picks, not of people.** Someone who picks three feelings contributes ⅓ to each. Percentages sum to 100.
6. **Spectrum caps at 7 segments**, sorted descending; remainder folds into the seventh. Below 5 total cards, show the raw dots instead of a bar and label it `EARLY DAYS · 4 CARDS`.
7. **Search by feeling is real.** `"gutted"` in Discover search returns productions whose top feeling is `gutted`. This is the differentiator; do not ship search without it.

## Room volume

Optional second field on the log. Three values: `murmur` · `applause` · `standing`. Copy on the buttons: `A MURMUR` / `REAL APPLAUSE` / `EVERYONE STOOD`.

Use it only for aggregate colour ("this room stands, most nights") and never as a quality score. Standing ovations are near-universal in some houses and rare in others; the signal is about the room, not the show.

## Interpretation copy

Every spectrum carries one sentence beneath it. Deterministic rules, in priority order:

| Condition | Sentence |
|---|---|
| top feeling ≥ 40% | `The room agreed.` |
| top two within 6 pts and opposed (one of delighted/buzzing/held vs one of gutted/unsettled/furious/bored) | `A divisive one — people either fell all the way in or spent the drive home arguing.` |
| `bored` in top three | `Some people checked out. Ask a friend who liked it first.` |
| top feeling is `held` or `seen` | `People felt taken care of in there.` |
| top feeling is `cracked_open` or `aching` | `Bring someone you can talk to afterwards.` |
| top feeling is `buzzing` or `delighted` | `A good night out, no homework required.` |
| fewer than 5 cards | `Too early to say. Be the one who says it.` |
| otherwise | `Mixed room. Worth finding out for yourself.` |

Append a venue-specific clause where it helps a newcomer decide, as in the prototype: *"Great first storefront-adjacent night out."* Keep total length under two lines at 390px.

## Personal palette

A person's palette is the same bar computed over their own logged shows, all-time (My Shows) or this season (profile). Its insight sentence is warmer and gently suggestive, never corrective:

- `You are, statistically, a person who likes to be {top1} and then {top2}.`
- `Mostly {top1}. You've been going to a lot of {dominant venue kind}. Maybe see something joyful before October.`

Never: "your taste is narrow", "you should diversify", a percentage of "positive" feelings, or any comparison to other users.
