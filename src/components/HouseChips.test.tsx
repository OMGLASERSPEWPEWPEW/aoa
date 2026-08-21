import { render, screen } from '@testing-library/react'
import { HouseChips } from './HouseChips'

describe('HouseChips', () => {
  it('renders 7 chips', () => {
    render(<HouseChips currentRank={3} />)
    expect(screen.getAllByTestId('house-chip')).toHaveLength(7)
  })

  it('achieved chips have strikethrough', () => {
    render(<HouseChips currentRank={3} />)
    const chips = screen.getAllByTestId('house-chip')
    // Ranks 0,1,2 are achieved (indices < 3)
    expect(chips[0].style.textDecoration).toBe('line-through')
    expect(chips[1].style.textDecoration).toBe('line-through')
    expect(chips[2].style.textDecoration).toBe('line-through')
  })

  it('current chip has gold color', () => {
    render(<HouseChips currentRank={3} />)
    const chips = screen.getAllByTestId('house-chip')
    expect(chips[3].style.color).toBe('var(--accent)')
    expect(chips[3].style.backgroundColor).toBe('var(--accent-bg)')
  })

  it('future chips have dashed border', () => {
    render(<HouseChips currentRank={3} />)
    const chips = screen.getAllByTestId('house-chip')
    expect(chips[4].style.border).toContain('dashed')
    expect(chips[5].style.border).toContain('dashed')
    expect(chips[6].style.border).toContain('dashed')
  })

  it('rank 0 has no achieved chips', () => {
    render(<HouseChips currentRank={0} />)
    const chips = screen.getAllByTestId('house-chip')
    expect(chips[0].style.color).toBe('var(--accent)')
    expect(chips[1].style.border).toContain('dashed')
  })
})
