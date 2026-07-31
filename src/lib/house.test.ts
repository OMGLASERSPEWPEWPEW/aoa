import { HOUSE_RANKS, rankRow, type HouseRank } from './house'

describe('HOUSE_RANKS', () => {
  it('has exactly 7 ranks', () => {
    expect(HOUSE_RANKS).toHaveLength(7)
  })

  it('first is Standing Room, last is Company', () => {
    expect(HOUSE_RANKS[0]).toBe('Standing Room')
    expect(HOUSE_RANKS[6]).toBe('Company')
  })
})

describe('rankRow', () => {
  it('rank 0 (Standing Room) → row 3 (back of house)', () => {
    expect(rankRow(0)).toBe(3)
  })

  it('rank 6 (Company) → row 0 (front row)', () => {
    expect(rankRow(6)).toBe(0)
  })

  it('monotonically decreasing (higher rank = closer to stage)', () => {
    const rows = ([0, 1, 2, 3, 4, 5, 6] as HouseRank[]).map(rankRow)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]).toBeLessThanOrEqual(rows[i - 1])
    }
  })
})
