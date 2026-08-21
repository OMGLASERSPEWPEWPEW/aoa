import { describe, it, expect } from 'vitest'
import { diagnoseVenue, diagnoseSchool } from './diagnosis'

const base = { name: 'Test Theater', venue_type: 'storefront', has_calendar_url: true, event_count: 5, source: 'chicagoplays' }

describe('diagnoseVenue', () => {
  it('returns ok for a healthy venue', () => {
    expect(diagnoseVenue(base).kind).toBe('ok')
  })

  it('returns aggregator for aggregator source', () => {
    expect(diagnoseVenue({ ...base, source: 'aggregator' }).kind).toBe('aggregator')
    expect(diagnoseVenue({ ...base, source: 'aggregator' }).severity).toBe('danger')
  })

  it('returns dead_site for consecutive_failures >= 2', () => {
    const d = diagnoseVenue({ ...base, consecutive_failures: 3 })
    expect(d.kind).toBe('dead_site')
    expect(d.label).toContain('DEAD SITE ×3')
    expect(d.severity).toBe('danger')
  })

  it('returns mistyped for institution-named non-school', () => {
    const d = diagnoseVenue({ ...base, name: 'Columbia College Theater Dept' })
    expect(d.kind).toBe('mistyped')
    expect(d.label).toContain('MISTYPED')
  })

  it('returns no_calendar when has_calendar_url is false', () => {
    const d = diagnoseVenue({ ...base, has_calendar_url: false })
    expect(d.kind).toBe('no_calendar')
    expect(d.label).toContain('NO CAL')
  })

  it('returns never_curated for 0 events with calendar', () => {
    const d = diagnoseVenue({ ...base, event_count: 0 })
    expect(d.kind).toBe('never_curated')
    expect(d.label).toContain('NEVER CURATED')
  })

  it('precedence: dead_site wins over mistyped', () => {
    const d = diagnoseVenue({ ...base, name: 'University Theater', consecutive_failures: 2 })
    expect(d.kind).toBe('dead_site')
  })

  it('limits label to 3 segments', () => {
    const d = diagnoseVenue({ ...base, name: 'University Theater', consecutive_failures: 2, has_calendar_url: false, event_count: 0 })
    const segments = d.label.split(' · ')
    expect(segments.length).toBeLessThanOrEqual(3)
  })
})

describe('diagnoseSchool', () => {
  it('returns ok for a school with sessions', () => {
    expect(diagnoseSchool({ name: 'iO', session_count: 5, last_curated_at: '2026-08-01' }).kind).toBe('ok')
  })

  it('returns never_curated for 0 sessions', () => {
    expect(diagnoseSchool({ name: 'iO', session_count: 0, last_curated_at: null }).kind).toBe('never_curated')
  })

  it('returns dead_site for consecutive_failures >= 2', () => {
    const d = diagnoseSchool({ name: 'iO', session_count: 5, last_curated_at: '2026-08-01', consecutive_failures: 4 })
    expect(d.kind).toBe('dead_site')
    expect(d.label).toContain('×4')
  })
})
