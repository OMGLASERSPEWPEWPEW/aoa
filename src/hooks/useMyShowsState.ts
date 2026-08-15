import { useState } from 'react'
import type { WatchlistStatus } from '../lib/types'

export type ViewMode = 'marquee' | 'ledger'

export function useMyShowsState() {
  const [view, setView] = useState<ViewMode>('marquee')
  const [tab, setTab] = useState<WatchlistStatus>('want_to_see')

  const toggleView = () => setView(v => (v === 'marquee' ? 'ledger' : 'marquee'))

  return { view, tab, setTab, toggleView }
}
