import { describe, it, expect, vi, afterEach } from 'vitest'
import { isUpTonight, getTonightTimes, formatShowTime } from './tonight'
import type { Event } from './types'

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: '1', venue_id: 'v1', title: 'Test', slug: 'test',
    description: null, event_type: 'show', genre_tags: [],
    start_date: '2026-07-01', end_date: '2026-08-31',
    show_times: null, price_min: null, price_max: null,
    ticket_url: null, hottix_available: false, photo_url: null,
    play_id: null, created_at: '',
    ...overrides,
  }
}

describe('isUpTonight', () => {
  afterEach(() => vi.useRealTimers())

  it('falls back to date range when no show_times', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T20:00:00-05:00'))
    expect(isUpTonight(makeEvent())).toBe(true)
  })

  it('returns false outside date range', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T20:00:00-05:00'))
    expect(isUpTonight(makeEvent())).toBe(false)
  })

  it('checks day-of-week schedule from show_times', () => {
    vi.useFakeTimers()
    // 2026-08-01 is a Saturday
    vi.setSystemTime(new Date('2026-08-01T20:00:00-05:00'))
    const event = makeEvent({
      show_times: { fri: ['19:30'], sat: ['14:00', '19:30'] },
    })
    expect(isUpTonight(event)).toBe(true)
  })

  it('returns false on dark day (no schedule entry)', () => {
    vi.useFakeTimers()
    // 2026-08-03 is a Monday
    vi.setSystemTime(new Date('2026-08-03T20:00:00-05:00'))
    const event = makeEvent({
      show_times: { fri: ['19:30'], sat: ['14:00', '19:30'] },
    })
    expect(isUpTonight(event)).toBe(false)
  })

  it('respects exceptions overriding regular schedule', () => {
    vi.useFakeTimers()
    // 2026-08-01 is a Saturday — normally has shows, but exception makes it dark
    vi.setSystemTime(new Date('2026-08-01T20:00:00-05:00'))
    const event = makeEvent({
      show_times: {
        sat: ['14:00', '19:30'],
        exceptions: { '2026-08-01': [] },
      },
    })
    expect(isUpTonight(event)).toBe(false)
  })
})

describe('getTonightTimes', () => {
  afterEach(() => vi.useRealTimers())

  it('returns empty array when show_times is null', () => {
    expect(getTonightTimes(null)).toEqual([])
  })

  it('returns times for current day of week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T20:00:00-05:00')) // Saturday
    expect(getTonightTimes({ sat: ['14:00', '19:30'] })).toEqual(['14:00', '19:30'])
  })

  it('returns empty array on dark day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T20:00:00-05:00')) // Monday
    expect(getTonightTimes({ sat: ['14:00'] })).toEqual([])
  })

  it('uses exception times over regular schedule', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T20:00:00-05:00'))
    const times = getTonightTimes({
      sat: ['14:00', '19:30'],
      exceptions: { '2026-08-01': ['15:00'] },
    })
    expect(times).toEqual(['15:00'])
  })
})

describe('formatShowTime', () => {
  it('formats afternoon time', () => {
    expect(formatShowTime('14:00')).toBe('2:00 PM')
  })

  it('formats evening time', () => {
    expect(formatShowTime('19:30')).toBe('7:30 PM')
  })

  it('formats morning time', () => {
    expect(formatShowTime('10:00')).toBe('10:00 AM')
  })

  it('formats midnight', () => {
    expect(formatShowTime('00:00')).toBe('12:00 AM')
  })

  it('formats noon', () => {
    expect(formatShowTime('12:00')).toBe('12:00 PM')
  })
})
