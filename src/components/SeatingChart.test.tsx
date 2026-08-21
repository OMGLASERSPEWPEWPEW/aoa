import { render, screen } from '@testing-library/react'
import { SeatingChart } from './SeatingChart'
import type { HouseRank } from '../lib/house'

describe('SeatingChart', () => {
  it('renders 32 seats (4 rows × 8)', () => {
    render(<SeatingChart rank={0} />)
    expect(screen.getAllByTestId('seat')).toHaveLength(32)
  })

  it('renders STAGE and STANDING ROOM labels', () => {
    render(<SeatingChart rank={0} />)
    expect(screen.getByText('STAGE')).toBeInTheDocument()
    expect(screen.getByText('STANDING ROOM')).toBeInTheDocument()
  })

  it('lights seat at row 3 for rank 0', () => {
    render(<SeatingChart rank={0} />)
    const seats = screen.getAllByTestId('seat')
    // Row 3, seat index 3 → global index = 3*8 + 3 = 27
    const litSeat = seats[27]
    expect(litSeat.style.width).toBe('11px')
    expect(litSeat.style.boxShadow).toContain('var(--accent)')
  })

  it('lights seat at row 0 for rank 6', () => {
    render(<SeatingChart rank={6} />)
    const seats = screen.getAllByTestId('seat')
    // Row 0, seat index 3 → global index = 0*8 + 3 = 3
    const litSeat = seats[3]
    expect(litSeat.style.width).toBe('11px')
    expect(litSeat.style.boxShadow).toContain('var(--accent)')
  })

  it('lit seat moves forward as rank increases', () => {
    const litPositions: number[] = []
    for (let rank = 0; rank <= 6; rank++) {
      const { unmount } = render(<SeatingChart rank={rank as HouseRank} />)
      const seats = screen.getAllByTestId('seat')
      const litIdx = seats.findIndex(s => s.style.width === '11px')
      litPositions.push(litIdx)
      unmount()
    }
    // Higher rank → lower row index → lower global index (closer to stage)
    for (let i = 1; i < litPositions.length; i++) {
      expect(litPositions[i]).toBeLessThanOrEqual(litPositions[i - 1])
    }
  })
})
