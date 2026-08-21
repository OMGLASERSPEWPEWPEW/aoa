import { describe, it, expect } from 'vitest'
import { fieldState } from './fieldState'
import type { FieldOverride } from './types'

const mockOverride: FieldOverride = {
  id: 'test-id',
  entity_type: 'venue',
  entity_id: 'entity-id',
  field_name: 'name',
  value: 'Admin Value',
  previous_value: 'Curator Value',
  edited_by: 'admin-id',
  edited_at: '2026-08-21T00:00:00Z',
}

describe('fieldState', () => {
  it('returns held when override exists', () => {
    expect(fieldState('anything', mockOverride)).toBe('held')
  })

  it('returns held even when value is null with override', () => {
    expect(fieldState(null, mockOverride)).toBe('held')
  })

  it('returns empty for null value', () => {
    expect(fieldState(null, null)).toBe('empty')
  })

  it('returns empty for empty string', () => {
    expect(fieldState('', null)).toBe('empty')
  })

  it('returns empty for empty array', () => {
    expect(fieldState([], null)).toBe('empty')
  })

  it('returns curated for 0 (zero is a value, not empty)', () => {
    expect(fieldState(0, null)).toBe('curated')
  })

  it('returns curated for false (false is a value, not empty)', () => {
    expect(fieldState(false, null)).toBe('curated')
  })

  it('returns curated for non-empty string', () => {
    expect(fieldState('storefront', null)).toBe('curated')
  })

  it('returns curated for non-empty array', () => {
    expect(fieldState(['comedy'], null)).toBe('curated')
  })

  it('returns empty for undefined', () => {
    expect(fieldState(undefined, null)).toBe('empty')
  })
})
