import { render, screen } from '@testing-library/react'
import { StatStrip } from './StatStrip'

describe('StatStrip', () => {
  it('renders 4 cells', () => {
    render(<StatStrip shows={5} venues={3} wrote={2} ushered={1} />)
    expect(screen.getAllByTestId('stat-cell')).toHaveLength(4)
  })

  it('shows correct labels', () => {
    render(<StatStrip shows={5} venues={3} wrote={2} ushered={1} />)
    expect(screen.getByText('SHOWS')).toBeInTheDocument()
    expect(screen.getByText('VENUES')).toBeInTheDocument()
    expect(screen.getByText('WROTE')).toBeInTheDocument()
    expect(screen.getByText('USHERED')).toBeInTheDocument()
  })

  it('shows correct values', () => {
    render(<StatStrip shows={12} venues={8} wrote={4} ushered={0} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('ushered value always has green color', () => {
    render(<StatStrip shows={0} venues={0} wrote={0} ushered={0} />)
    const usheredValue = screen.getByText('0', {
      selector: '[style*="var(--access)"]',
    })
    expect(usheredValue).toBeInTheDocument()
  })
})
