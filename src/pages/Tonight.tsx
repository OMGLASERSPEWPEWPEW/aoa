import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { isUpTonight } from '../lib/tonight'
import { MarqueeTicker } from '../components/MarqueeTicker'
import { TonightHero } from '../components/TonightHero'
import { TonightFriends } from '../components/TonightFriends'
import { TonightFree } from '../components/TonightFree'
import type { Event, SpectrumSlice } from '../lib/types'

async function fetchTonightData() {
  const { data: allEvents } = await supabase
    .from('events')
    .select('*, venue:venues(*)')
    .order('start_date', { ascending: true })

  const events = (allEvents as Event[]) ?? []
  const tonightEvents = events.filter(isUpTonight)
  const under20 = events.filter(e => e.price_min !== null && e.price_min <= 20)
  const free = tonightEvents.filter(e =>
    (e.price_min === 0 || e.price_min === null) &&
    (e.price_max === 0 || e.price_max === null)
  )
  const cheapest = [...tonightEvents]
    .filter(e => e.price_min !== null)
    .sort((a, b) => (a.price_min ?? 999) - (b.price_min ?? 999))

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const openingTonight = tonightEvents.filter(e => e.start_date === today)
  const hero = tonightEvents[0] ?? events[0] ?? null

  let heroSpectrum: SpectrumSlice[] = []
  let heroTotalCards = 0

  if (hero) {
    const { data: specData } = await supabase
      .from('event_emotion_counts')
      .select('*')
      .eq('event_id', hero.id)

    if (specData && specData.length > 0) {
      const total = specData.reduce((s: number, r: any) => s + (r.pick_count ?? 0), 0)
      heroTotalCards = Math.ceil(total / 3)
      heroSpectrum = specData
        .map((r: any) => ({
          emotion: r.emotion_slug,
          pct: total > 0 ? Math.round((r.pick_count / total) * 100) : 0,
        }))
        .filter((s: SpectrumSlice) => s.pct > 0)
    }
  }

  return {
    hero,
    heroSpectrum,
    heroTotalCards,
    tonightCount: tonightEvents.length,
    under20Count: under20.length,
    openingsCount: openingTonight.length,
    freeEvents: free,
    cheapestEvents: cheapest,
  }
}

export function Tonight() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tonight-events'],
    queryFn: fetchTonightData,
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const { onTouchStart, onTouchEnd } = usePullToRefresh(scrollRef, async () => { await refetch() })

  const loading = isLoading
  const heroEvent = data?.hero ?? null
  const heroSpectrum = data?.heroSpectrum ?? []
  const heroTotalCards = data?.heroTotalCards ?? 0
  const tonightCount = data?.tonightCount ?? 0
  const under20Count = data?.under20Count ?? 0
  const openingsCount = data?.openingsCount ?? 0
  const freeEvents = data?.freeEvents ?? []
  const cheapestEvents = data?.cheapestEvents ?? []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-faint)' }}>
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
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div className="flex items-baseline gap-1.5">
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontWeight: 700,
              fontSize: 19,
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
            }}
          >
            The Art of Art
          </span>
          <span
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10,
              color: 'var(--ink-faint)',
            }}
          >
            • chicago
          </span>
        </div>
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>⊙</span>
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
