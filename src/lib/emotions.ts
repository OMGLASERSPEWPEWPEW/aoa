export type Emotion =
  | 'delighted' | 'electrified' | 'furious' | 'gutted' | 'aching' | 'cracked_open'
  | 'unsettled' | 'transported' | 'seen' | 'held' | 'buzzing' | 'bored'

export interface EmotionDef {
  readonly slug: Emotion
  readonly label: string
  readonly l: number
  readonly c: number
  readonly h: number
}

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
] as const satisfies readonly EmotionDef[]

export const base   = (e: EmotionDef) => `oklch(${e.l} ${e.c} ${e.h})`
export const fill   = (e: EmotionDef) => `oklch(0.21 ${(e.c * 0.3).toFixed(3)} ${e.h})`
export const edge   = (e: EmotionDef) => `oklch(0.36 ${(e.c * 0.5).toFixed(3)} ${e.h})`
export const bright = (e: EmotionDef) => `oklch(${(e.l + 0.12).toFixed(2)} ${(e.c - 0.03).toFixed(2)} ${e.h})`

export function emotionBySlug(slug: Emotion): EmotionDef {
  return EMOTIONS.find(e => e.slug === slug)!
}

export type RoomVolume = 'murmur' | 'applause' | 'standing'

export interface SpectrumSlice {
  emotion: Emotion
  pct: number
}

type InterpretationRule = {
  test: (slices: SpectrumSlice[], totalCards: number) => boolean
  sentence: string
}

const OPPOSED_HIGH = new Set<Emotion>(['delighted', 'buzzing', 'held'])
const OPPOSED_LOW = new Set<Emotion>(['gutted', 'unsettled', 'furious', 'bored'])

export const INTERPRETATION_RULES: InterpretationRule[] = [
  {
    test: (s) => s.length > 0 && s[0].pct >= 40,
    sentence: 'The room agreed.',
  },
  {
    test: (s) =>
      s.length >= 2 &&
      Math.abs(s[0].pct - s[1].pct) <= 6 &&
      ((OPPOSED_HIGH.has(s[0].emotion) && OPPOSED_LOW.has(s[1].emotion)) ||
       (OPPOSED_LOW.has(s[0].emotion) && OPPOSED_HIGH.has(s[1].emotion))),
    sentence: 'A divisive one — people either fell all the way in or spent the drive home arguing.',
  },
  {
    test: (s) => s.slice(0, 3).some(x => x.emotion === 'bored'),
    sentence: 'Some people checked out. Ask a friend who liked it first.',
  },
  {
    test: (s) => s.length > 0 && (s[0].emotion === 'held' || s[0].emotion === 'seen'),
    sentence: 'People felt taken care of in there.',
  },
  {
    test: (s) => s.length > 0 && (s[0].emotion === 'cracked_open' || s[0].emotion === 'aching'),
    sentence: 'Bring someone you can talk to afterwards.',
  },
  {
    test: (s) => s.length > 0 && (s[0].emotion === 'buzzing' || s[0].emotion === 'delighted'),
    sentence: 'A good night out, no homework required.',
  },
  {
    test: (_, total) => total < 5,
    sentence: 'Too early to say. Be the one who says it.',
  },
  {
    test: () => true,
    sentence: 'Mixed room. Worth finding out for yourself.',
  },
]

export function interpretSpectrum(slices: SpectrumSlice[], totalCards: number): string {
  for (const rule of INTERPRETATION_RULES) {
    if (rule.test(slices, totalCards)) return rule.sentence
  }
  return INTERPRETATION_RULES[INTERPRETATION_RULES.length - 1].sentence
}
