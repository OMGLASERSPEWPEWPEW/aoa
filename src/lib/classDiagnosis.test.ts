import { describe, it, expect } from 'vitest'
import { sessionDiagnosis } from './classDiagnosis'
import type { ClassSession } from './types'

function makeSession(overrides: Partial<ClassSession> = {}): ClassSession {
  return {
    id: 'test-1',
    school_id: 'school-1',
    title: 'Level 1',
    level: 1,
    starts_on: '2026-09-21',
    schedule: 'Mondays, 6:30p–9:30p',
    weeks: 8,
    price: 495,
    seats_total: 16,
    seats_taken: 4,
    drop_in: false,
    no_experience: true,
    audition_required: false,
    prerequisite: null,
    signup_url: null,
    scraped_at: '2026-08-21',
    source_url: '/core/level-1',
    created_at: '2026-08-21',
    instructor_name: 'Jack Bronis',
    status: 'open',
    program_name: 'Core · Level 1',
    program_group: null,
    sort_order: null,
    delivery: 'in_person',
    deleted_at: null,
    day_of_week: 'Monday',
    start_time: '18:30',
    end_time: '21:30',
    ...overrides,
  }
}

describe('sessionDiagnosis', () => {
  it('returns ok for a complete session', () => {
    const d = sessionDiagnosis(makeSession())
    expect(d.problems).toEqual([])
    expect(d.label).toBeNull()
    expect(d.severity).toBe('neutral')
  })

  it('returns wont_show when both starts_on and schedule are missing', () => {
    const d = sessionDiagnosis(makeSession({ starts_on: null, schedule: null }))
    expect(d.problems).toEqual(['wont_show'])
    expect(d.label).toContain("WON’T SHOW")
    expect(d.severity).toBe('danger')
  })

  it('wont_show short-circuits even if price is also missing', () => {
    const d = sessionDiagnosis(makeSession({
      starts_on: null, schedule: null, price: null,
    }))
    expect(d.problems).toEqual(['wont_show'])
    expect(d.label).not.toContain('NO PRICE')
  })

  it('returns no_price when price is null', () => {
    const d = sessionDiagnosis(makeSession({ price: null }))
    expect(d.problems).toContain('no_price')
    expect(d.label).toContain('NO PRICE')
    expect(d.severity).toBe('warn')
  })

  it('returns no_level when level is null', () => {
    const d = sessionDiagnosis(makeSession({ level: null }))
    expect(d.problems).toContain('no_level')
    expect(d.label).toContain('NO LEVEL')
  })

  it('returns no_instructor when instructor_name is missing', () => {
    const d = sessionDiagnosis(makeSession({ instructor_name: null }))
    expect(d.problems).toContain('no_instructor')
    expect(d.label).toContain('NO INSTRUCTOR')
    expect(d.severity).toBe('neutral')
  })

  it('joins multiple problems with ·', () => {
    const d = sessionDiagnosis(makeSession({
      price: null, level: null, instructor_name: null,
    }))
    expect(d.label).toBe('NO PRICE · NO LEVEL · NO INSTRUCTOR')
    expect(d.problems).toHaveLength(3)
  })
})
