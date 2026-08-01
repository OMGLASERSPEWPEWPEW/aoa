import { describe, it, expect } from 'vitest'
import { personalInsight } from './useEmotionAggregates'
import type { SpectrumSlice } from '../lib/types'

describe('personalInsight', () => {
  it('returns empty string for no slices', () => {
    expect(personalInsight([])).toBe('')
  })

  it('returns two-emotion sentence when both present', () => {
    const slices: SpectrumSlice[] = [
      { emotion: 'delighted', pct: 60 },
      { emotion: 'held', pct: 40 },
    ]
    const result = personalInsight(slices)
    expect(result).toContain('delighted')
    expect(result).toContain('held')
    expect(result).toContain('statistically')
  })

  it('returns single-emotion sentence when only one', () => {
    const slices: SpectrumSlice[] = [
      { emotion: 'gutted', pct: 100 },
    ]
    const result = personalInsight(slices)
    expect(result).toContain('gutted')
    expect(result).toContain('Mostly')
  })

  it('uses lowercase emotion labels', () => {
    const slices: SpectrumSlice[] = [
      { emotion: 'cracked_open', pct: 55 },
      { emotion: 'buzzing', pct: 45 },
    ]
    const result = personalInsight(slices)
    expect(result).toContain('cracked open')
    expect(result).toContain('buzzing')
  })
})
