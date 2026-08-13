import { render, screen } from '@testing-library/react'
import { beforeAll } from 'vitest'
import { SpectrumBar } from './SpectrumBar'
import { ThemeProvider } from '../contexts/ThemeContext'
import type { SpectrumSlice } from '../lib/emotions'

beforeAll(() => {
  window.matchMedia = window.matchMedia || function () {
    return { matches: false, media: '', onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as MediaQueryList
  }
})

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('SpectrumBar', () => {
  it('renders segments sorted descending', () => {
    const slices: SpectrumSlice[] = [
      { emotion: 'bored', pct: 25 },
      { emotion: 'delighted', pct: 35 },
      { emotion: 'gutted', pct: 40 },
    ]
    const { container } = wrap(<SpectrumBar slices={slices} height={11} totalCards={20} />)
    const segments = container.querySelectorAll('[data-emotion]')
    expect(segments[0].getAttribute('data-emotion')).toBe('gutted')
    expect(segments[1].getAttribute('data-emotion')).toBe('delighted')
    expect(segments[2].getAttribute('data-emotion')).toBe('bored')
  })

  it('caps at 7 segments', () => {
    const slices: SpectrumSlice[] = Array.from({ length: 10 }, (_, i) => ({
      emotion: (['delighted', 'electrified', 'furious', 'gutted', 'aching', 'cracked_open', 'unsettled', 'transported', 'seen', 'held'] as const)[i],
      pct: 10,
    }))
    const { container } = wrap(<SpectrumBar slices={slices} height={11} totalCards={50} />)
    const segments = container.querySelectorAll('[data-emotion]')
    expect(segments.length).toBe(7)
  })

  it('shows early days mode when totalCards < 5', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'delighted', pct: 100 }]
    wrap(<SpectrumBar slices={slices} height={11} totalCards={3} />)
    expect(screen.getByText(/EARLY DAYS/)).toBeInTheDocument()
  })

  it('does not show early days when totalCards >= 5', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'delighted', pct: 60 }, { emotion: 'gutted', pct: 40 }]
    wrap(<SpectrumBar slices={slices} height={11} totalCards={10} />)
    expect(screen.queryByText(/EARLY DAYS/)).not.toBeInTheDocument()
  })

  it('shows percentages below bar when totalCards >= 5', () => {
    const slices: SpectrumSlice[] = [{ emotion: 'delighted', pct: 60 }, { emotion: 'gutted', pct: 40 }]
    wrap(<SpectrumBar slices={slices} height={11} totalCards={10} />)
    expect(screen.getByText(/Delighted 60%/)).toBeInTheDocument()
    expect(screen.getByText(/Gutted 40%/)).toBeInTheDocument()
  })
})
