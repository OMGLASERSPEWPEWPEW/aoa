import { describe, it, expect } from 'vitest'
import { preferSuggestion } from './suggestions'
import type { CuratorSuggestion } from './types'

function makeSuggestion(overrides: Partial<CuratorSuggestion> = {}): CuratorSuggestion {
  return {
    id: 'test',
    entity_type: 'venue',
    entity_id: 'eid',
    field_name: 'calendar_url',
    suggested_value: 'https://new.com',
    evidence: null,
    times_suggested: 1,
    status: 'open',
    first_seen_at: '2026-08-21T00:00:00Z',
    last_seen_at: '2026-08-21T00:00:00Z',
    ...overrides,
  }
}

describe('preferSuggestion', () => {
  it('returns true when events_found beats current', () => {
    const s = makeSuggestion({
      evidence: { events_found: 11, events_found_current: 8 },
    })
    expect(preferSuggestion(s)).toBe(true)
  })

  it('returns true when events_found beats zero current', () => {
    const s = makeSuggestion({
      evidence: { events_found: 5 },
    })
    expect(preferSuggestion(s)).toBe(true)
  })

  it('returns false when confidence < 0.75', () => {
    const s = makeSuggestion({
      evidence: { confidence: 0.62 },
    })
    expect(preferSuggestion(s)).toBe(false)
  })

  it('returns true when times_suggested >= 3', () => {
    const s = makeSuggestion({ times_suggested: 3 })
    expect(preferSuggestion(s)).toBe(true)
  })

  it('returns true when times_suggested is 4', () => {
    const s = makeSuggestion({ times_suggested: 4 })
    expect(preferSuggestion(s)).toBe(true)
  })

  it('returns false by default (ambiguous case)', () => {
    const s = makeSuggestion()
    expect(preferSuggestion(s)).toBe(false)
  })

  it('returns false for high confidence alone (no events_found)', () => {
    const s = makeSuggestion({
      evidence: { confidence: 0.95 },
    })
    expect(preferSuggestion(s)).toBe(false)
  })

  it('events_found rule takes precedence over low confidence', () => {
    const s = makeSuggestion({
      evidence: { events_found: 10, events_found_current: 3, confidence: 0.5 },
    })
    expect(preferSuggestion(s)).toBe(true)
  })
})
