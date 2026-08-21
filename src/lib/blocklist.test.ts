import { describe, it, expect } from 'vitest'
import { normalizeDomain, BLOCK_REASON_LABELS } from './blocklist'
import fixtures from './__fixtures__/domains.json'

describe('normalizeDomain', () => {
  it.each(fixtures)('normalizeDomain(%j) → %j', (input, expected) => {
    expect(normalizeDomain(input as string | null)).toBe(expected)
  })
})

describe('BLOCK_REASON_LABELS', () => {
  it('has labels for all reasons', () => {
    expect(Object.keys(BLOCK_REASON_LABELS)).toEqual(
      expect.arrayContaining(['aggregator', 'closed', 'duplicate', 'not_chicago', 'other'])
    )
  })
})
