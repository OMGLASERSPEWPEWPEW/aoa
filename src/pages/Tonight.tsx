import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { MarqueeTicker } from '../components/MarqueeTicker'
import { TonightHero } from '../components/TonightHero'
import { TonightFriends } from '../components/TonightFriends'
import { TonightFree } from '../components/TonightFree'
import type { Event, SpectrumSlice } from '../lib/types'

export function Tonight() {
  const [heroEvent, setHeroEvent] = useState<Event | null>(null)
  const [heroSpectrum, setHeroSpectrum] = useState<SpectrumSlice[]>([])
  const [heroTotalCards, setHeroTotalCards] = useState(0)
  const [tonightCount, setTonightCount] = useState(0)
  const [under20Count, setUnder20Count] = useState(0)
  const [openingsCount, setOpeningsCount] = useState(0)
  const [freeEvents, setFreeEvents] = useState<Event[]>([])
  const [cheapestEvents, setCheapestEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { onTouchStart, onTouchEnd } = usePullToRefresh(scrollRef, async () => { await loadData() })

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: allEvents } = await supabase
      .from('events')
      .select('*, venue:venues(*)')
      .order('start_date', { ascending: true })

    const events = (allEvents as Event[]) ?? []

    const today = new Date().toISOString().split('T')[0]
    const tonightEvents = events.filter(e =>
      e.start_date && e.end_date
        ? e.start_date <= today && e.end_date >= today
        : e.start_date === today
    )

    const under20 = events.filter(e => e.price_min !== null && e.price_min <= 20)
    const free = tonightEvents.filter(e =>
      (e.price_min === 0 || e.price_min === null) &&
      (e.price_max === 0 || e.price_max === null)
    )
    const cheapest = [...tonightEvents]
      .filter(e => e.price_min !== null)
      .sort((a, b) => (a.price_min ?? 999) - (b.price_min ?? 999))

    const openingTonight = tonightEvents.filter(e => e.start_date === today)

    setTonightCount(tonightEvents.length)
    setUnder20Count(under20.length)
    setOpeningsCount(openingTonight.length)
    setFreeEvents(free)
    setCheapestEvents(cheapest)

    const hero = tonightEvents[0] ?? events[0] ?? null
    setHeroEvent(hero)

    if (hero) {
      const { data: specData } = await supabase
        .from('event_emotion_counts')
        .select('*')
        .eq('event_id', hero.id)

      if (specData && specData.length > 0) {
        const total = specData.reduce((s: number, r: any) => s + (r.pick_count ?? 0), 0)
        setHeroTotalCards(Math.ceil(total / 3))
        setHeroSpectrum(
          specData.map((r: any) => ({
            emotion: r.emotion_slug,
            pct: total > 0 ? Math.round((r.pick_count / total) * 100) : 0,
          })).filter((s: SpectrumSlice) => s.pct > 0)
        )
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#625b4c' }}>
        Loading...
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Masthead */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '8px 20px 12px',
          borderBottom: '1px solid #2b2720',
        }}
      >
        <div className="flex items-baseline gap-1.5">
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontWeight: 700,
              fontSize: 19,
              letterSpacing: '-0.01em',
              color: '#ebe5d6',
            }}
          >
            The Art of Art
          </span>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              color: '#625b4c',
            }}
          >
            • chicago
          </span>
        </div>
        <span style={{ fontSize: 18, color: '#9c9586' }}>⊙</span>
      </div>

      <MarqueeTicker
        tonightCount={tonightCount}
        under20Count={under20Count}
        openingsCount={openingsCount}
      />

      {heroEvent && (
        <TonightHero
          event={heroEvent}
          spectrum={heroSpectrum}
          totalCards={heroTotalCards}
        />
      )}

      <TonightFriends />

      <TonightFree
        freeEvents={freeEvents}
        cheapestEvents={cheapestEvents}
      />
    </div>
  )
}
