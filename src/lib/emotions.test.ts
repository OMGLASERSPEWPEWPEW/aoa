import { EMOTIONS, base, fill, edge, bright, emotionBySlug, interpretSpectrum, type SpectrumSlice } from './emotions'

describe('EMOTIONS', () => {
  it('has exactly 12 emotions', () => {
    expect(EMOTIONS).toHaveLength(12)
  })

  it('each emotion has slug, label, l, c, h', () => {
    for (const e of EMOTIONS) {
      expect(e.slug).toBeTruthy()
      expect(e.label).toBeTruthy()
      expect(e.l).toBeGreaterThan(0)
      expect(e.c).toBeGreaterThan(0)
      expect(e.h).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('color functions', () => {
  const delighted = EMOTIONS[0]

  it('base() returns valid oklch string', () => {
    expect(base(delighted)).toBe('oklch(0.82 0.15 90)')
  })

  it('fill() returns oklch with 0.21 lightness and 0.3× chroma', () => {
    expect(fill(delighted)).toBe('oklch(0.21 0.045 90)')
  })

  it('edge() returns oklch with 0.36 lightness and 0.5× chroma', () => {
    expect(edge(delighted)).toBe('oklch(0.36 0.075 90)')
  })

  it('bright() adds 0.12 lightness and subtracts 0.03 chroma', () => {
    expect(bright(delighted)).toBe('oklch(0.94 0.12 90)')
  })

  it('works for all 12 emotions', () => {
    for (const e of EMOTIONS) {
      expect(base(e)).toMatch(/^oklch\(/)
      expect(fill(e)).toMatch(/^oklch\(0\.21/)
      expect(edge(e)).toMatch(/^oklch\(0\.36/)
      expect(bright(e)).toMatch(/^oklch\(/)
    }
  })
})

describe('emotionBySlug', () => {
  it('returns correct definition for each slug', () => {
    for (const e of EMOTIONS) {
      expect(emotionBySlug(e.slug)).toBe(e)
    }
  })
})

describe('interpretSpectrum', () => {
  it('rule 1: top feeling >= 40% → "The room agreed."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'delighted', pct: 45 }, { emotion: 'gutted', pct: 30 }, { emotion: 'bored', pct: 25 }]
    expect(interpretSpectrum(slices, 20)).toBe('The room agreed.')
  })

  it('rule 2: top two within 6pts and opposed → "A divisive one..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'delighted', pct: 32 }, { emotion: 'gutted', pct: 30 }, { emotion: 'bored', pct: 38 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/A divisive one/)
  })

  it('rule 3: bored in top 3 → "Some people checked out..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'transported', pct: 25 }, { emotion: 'electrified', pct: 20 }, { emotion: 'bored', pct: 15 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/Some people checked out/)
  })

  it('rule 4: top = held → "People felt taken care of..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'held', pct: 35 }, { emotion: 'delighted', pct: 20 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/People felt taken care of/)
  })

  it('rule 4: top = seen → "People felt taken care of..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'seen', pct: 35 }, { emotion: 'delighted', pct: 20 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/People felt taken care of/)
  })

  it('rule 5: top = cracked_open → "Bring someone..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'cracked_open', pct: 35 }, { emotion: 'delighted', pct: 20 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/Bring someone you can talk to/)
  })

  it('rule 5: top = aching → "Bring someone..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'aching', pct: 35 }, { emotion: 'delighted', pct: 20 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/Bring someone you can talk to/)
  })

  it('rule 6: top = buzzing → "A good night out..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'buzzing', pct: 35 }, { emotion: 'gutted', pct: 20 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/A good night out/)
  })

  it('rule 6: top = delighted → "A good night out..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'delighted', pct: 35 }, { emotion: 'gutted', pct: 20 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/A good night out/)
  })

  it('rule 7: totalCards < 5 → "Too early to say..."', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'transported', pct: 35 }]
    expect(interpretSpectrum(slices, 3)).toMatch(/Too early to say/)
  })

  it('rule 8: fallback → "Mixed room..."', () => {
    const slices: SpectrumSlice[] = [
      { emotion: 'transported', pct: 20 },
      { emotion: 'electrified', pct: 18 },
      { emotion: 'furious', pct: 16 },
      { emotion: 'held', pct: 14 },
    ]
    expect(interpretSpectrum(slices, 20)).toMatch(/Mixed room/)
  })

  it('priority: rule 1 beats rule 4 (held at 45%)', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'held', pct: 45 }, { emotion: 'delighted', pct: 30 }]
    expect(interpretSpectrum(slices, 20)).toBe('The room agreed.')
  })

  it('priority: rule 2 beats rule 3 (opposed pair includes bored)', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'delighted', pct: 33 }, { emotion: 'bored', pct: 30 }, { emotion: 'held', pct: 20 }]
    expect(interpretSpectrum(slices, 20)).toMatch(/A divisive one/)
  })

  it('returns fallback for empty slices with enough cards', () => {
    expect(interpretSpectrum([], 20)).toMatch(/Mixed room/)
  })

  it('returns early days for empty slices with few cards', () => {
    expect(interpretSpectrum([], 2)).toMatch(/Too early to say/)
  })
})
