import { describe, it, expect } from 'vitest'
import { groupSessions, programGroupLabel } from './classGrouping'
import type { ClassSessionRow, SessionDiagnosis } from './types'

const okDiag: SessionDiagnosis = { problems: [], label: null, severity: 'neutral' }

function makeRow(overrides: Partial<ClassSessionRow> = {}): ClassSessionRow {
  return {
    id: `row-${Math.random().toString(36).slice(2, 6)}`,
    school_id: 'school-1',
    title: 'Level 1',
    level: 1,
    starts_on: '2026-09-21',
    schedule: 'Mondays',
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
    overrides: {},
    diagnosis: okDiag,
    ...overrides,
  }
}

describe('programGroupLabel', () => {
  it('uppercases a normal label', () => {
    expect(programGroupLabel('Core · Level 1')).toBe('CORE · LEVEL 1')
  })

  it('returns UNGROUPED for null', () => {
    expect(programGroupLabel(null)).toBe('UNGROUPED')
  })

  it('handles single word', () => {
    expect(programGroupLabel('Voiceover')).toBe('VOICEOVER')
  })
})

describe('groupSessions', () => {
  it('groups by program_group when present', () => {
    const rows = [
      makeRow({ id: 'a', program_group: 'Core · Level 1' }),
      makeRow({ id: 'b', program_group: 'Core · Level 2' }),
      makeRow({ id: 'c', program_group: 'Core · Level 1' }),
    ]
    const groups = groupSessions(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0].sessions).toHaveLength(2)
    expect(groups[1].sessions).toHaveLength(1)
  })

  it('falls back to program_name when program_group is null', () => {
    const rows = [
      makeRow({ id: 'a', program_group: null, program_name: 'On Camera' }),
      makeRow({ id: 'b', program_group: null, program_name: 'On Camera' }),
    ]
    const groups = groupSessions(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('On Camera')
  })

  it('puts __ungrouped last', () => {
    const rows = [
      makeRow({ id: 'a', program_group: null, program_name: null, starts_on: '2026-12-01' }),
      makeRow({ id: 'b', program_group: 'Core · Level 1', starts_on: '2026-09-21' }),
    ]
    const groups = groupSessions(rows)
    expect(groups[groups.length - 1].key).toBe('__ungrouped')
  })

  it('sorts within group by sort_order then starts_on then id', () => {
    const rows = [
      makeRow({ id: 'c', program_group: 'G', sort_order: null, starts_on: '2026-09-23' }),
      makeRow({ id: 'a', program_group: 'G', sort_order: 0, starts_on: '2026-09-21' }),
      makeRow({ id: 'b', program_group: 'G', sort_order: 10, starts_on: '2026-09-22' }),
    ]
    const groups = groupSessions(rows)
    expect(groups[0].sessions.map(s => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('handles all-null sort_order', () => {
    const rows = [
      makeRow({ id: 'b', program_group: 'G', sort_order: null, starts_on: '2026-09-22' }),
      makeRow({ id: 'a', program_group: 'G', sort_order: null, starts_on: '2026-09-21' }),
    ]
    const groups = groupSessions(rows)
    expect(groups[0].sessions.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('respects collapsed state', () => {
    const rows = [
      makeRow({ id: 'a', program_group: 'Core · Level 1' }),
    ]
    const groups = groupSessions(rows, new Set(['Core · Level 1']))
    expect(groups[0].collapsed).toBe(true)
  })
})
