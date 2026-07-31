const GENRE_HUE: Record<string, number> = {
  musical: 90,
  comedy: 90,
  drama: 250,
  literary: 250,
  experimental: 300,
  devised: 300,
  classic: 55,
  shakespeare: 55,
  'new work': 150,
  premiere: 150,
  thriller: 25,
}

export function genreHue(genre: string): number | null {
  const key = genre.toLowerCase()
  return GENRE_HUE[key] ?? null
}
