export const HOUSE_RANKS = [
  'Standing Room',
  'Balcony',
  'Mezzanine',
  'Orchestra',
  'Front Row',
  'Green Room',
  'Company',
] as const

export type HouseRank = 0 | 1 | 2 | 3 | 4 | 5 | 6

export function rankRow(rank: HouseRank): number {
  return 3 - Math.floor(rank * 3 / 6)
}

export const RANK_UP_COPY: Record<Exclude<HouseRank, 0>, string> = {
  1: "That’s one. The rest of your life in this city just got a little bigger.",
  2: "Three shows, two rooms. You’re not a tourist anymore.",
  3: "Six shows in. You have opinions now, and they’re good ones.",
  4: "Opening nights are yours. Get there early; the lobby is the point.",
  5: "You bring people. That’s the whole thing, really.",
  6: "Twenty-five shows, eight rooms, two seasons. You’re part of this.",
}

export const RANK_CRITERIA: Record<HouseRank, string> = {
  0: 'Sign up, finish onboarding',
  1: '1 show logged with feelings',
  2: '3 shows across 2+ venues',
  3: '6 shows, 3+ venues, 3 written reflections',
  4: '12 shows in one season, 2+ kinds of room, and 1 opening night or 1 usher shift',
  5: '5+ reviews, ushered twice, 2 friends who logged a show',
  6: '25+ shows over 2+ seasons, 8+ venues, a review in each of the last 6 months',
}
