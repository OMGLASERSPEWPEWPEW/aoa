import { describe, it, expect } from 'vitest'
import { applyMove, reindex } from './reorder'
import type { ClassGroup, ClassSessionRow, SessionDiagnosis } from './types'

const okDiag: SessionDiagnosis = { problems: [], label: null, severity: 'neutral' }

function makeRow(id: string, overrides: Partial<ClassSessionRow> = {}): ClassSessionRow {
  return {
    id,
    school_id: 'school-1',
    title: `Class ${id}`,
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
    instructor_name: null,
    status: 'open',
    program_name: null,
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

function makeGroup(key: string, ids: string[]): ClassGroup {
  return {
    key,
    label: key.toUpperCase(),
    sessions: ids.map(id => makeRow(id, { program_group: key })),
    collapsed: false,
  }
}

describe('applyMove', () => {
  it('moves within the same group', () => {
    const groups = [makeGroup('G1', ['a', 'b', 'c'])]
    const result = applyMove(groups, { id: 'c', toGroup: 'G1', toIndex: 0 })
    expect(result[0].sessions.map(s => s.id)).toEqual(['c', 'a', 'b'])
  })

  it('moves to end of same group', () => {
    const groups = [makeGroup('G1', ['a', 'b', 'c'])]
    const result = applyMove(groups, { id: 'a', toGroup: 'G1', toIndex: 2 })
    expect(result[0].sessions.map(s => s.id)).toEqual(['b', 'c', 'a'])
  })

  it('moves between groups', () => {
    const groups = [makeGroup('G1', ['a', 'b']), makeGroup('G2', ['c', 'd'])]
    const result = applyMove(groups, { id: 'a', toGroup: 'G2', toIndex: 1 })
    expect(result[0].sessions.map(s => s.id)).toEqual(['b'])
    expect(result[1].sessions.map(s => s.id)).toEqual(['c', 'a', 'd'])
    expect(result[1].sessions[1].program_group).toBe('G2')
  })

  it('handles single-row group (source becomes empty, filtered out)', () => {
    const groups = [makeGroup('G1', ['a']), makeGroup('G2', ['b'])]
    const result = applyMove(groups, { id: 'a', toGroup: 'G2', toIndex: 0 })
    expect(result).toHaveLength(1)
    expect(result[0].sessions.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('move to index 0', () => {
    const groups = [makeGroup('G1', ['a', 'b', 'c'])]
    const result = applyMove(groups, { id: 'b', toGroup: 'G1', toIndex: 0 })
    expect(result[0].sessions.map(s => s.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('reindex', () => {
  it('assigns sequential sort_order in steps of 10', () => {
    const group = makeGroup('G1', ['a', 'b', 'c'])
    const moves = reindex(group)
    expect(moves).toEqual([
      { id: 'a', sort_order: 0, program_group: 'G1' },
      { id: 'b', sort_order: 10, program_group: 'G1' },
      { id: 'c', sort_order: 20, program_group: 'G1' },
    ])
  })

  it('handles single-row group', () => {
    const group = makeGroup('G1', ['x'])
    const moves = reindex(group)
    expect(moves).toEqual([{ id: 'x', sort_order: 0, program_group: 'G1' }])
  })
})
