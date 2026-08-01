import { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useWatchlist } from '../hooks/useWatchlist'
import { createMarkerElement } from './MapMarker'
import { MapFilterChips } from './MapFilterChips'
import { MapKey } from './MapKey'
import { VenueSheet } from './VenueSheet'
import { isUpTonight } from '../lib/tonight'
import type { Venue, Event } from '../lib/types'

const CHICAGO_CENTER: [number, number] = [-87.6298, 41.8781]

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; venue: Venue }>>(new Map())
  const { user } = useAuth()
  const { getStatus } = useWatchlist()

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)

  const hasToken = !!import.meta.env.VITE_MAPBOX_TOKEN

  const { data: mapData } = useQuery({
    queryKey: ['map-data', user?.id],
    queryFn: async () => {
      const [venueRes, eventRes] = await Promise.all([
        supabase.from('venues').select('*').not('latitude', 'is', null).not('longitude', 'is', null),
        supabase.from('events').select('*, venue:venues(*)').order('start_date', { ascending: true }),
      ])
      const venues = (venueRes.data as Venue[]) ?? []
      const events = (eventRes.data as Event[]) ?? []

      let visitCounts: Record<string, number> = {}
      let lastVisitDates: Record<string, string> = {}

      if (user) {
        const { data: watchlist } = await supabase
          .from('watchlist')
          .select('event_id, seen_date, events(venue_id)')
          .eq('user_id', user.id)
          .eq('status', 'seen')
        for (const w of watchlist ?? []) {
          const vid = (w as any).events?.venue_id
          if (vid) {
            visitCounts[vid] = (visitCounts[vid] ?? 0) + 1
            const sd = (w as any).seen_date
            if (sd && (!lastVisitDates[vid] || sd > lastVisitDates[vid])) {
              lastVisitDates[vid] = sd
            }
          }
        }
      }

      return { venues, events, visitCounts, lastVisitDates }
    },
  })

  const venues = mapData?.venues ?? []
  const events = mapData?.events ?? []
  const visitCounts = mapData?.visitCounts ?? {}
  const lastVisitDates = mapData?.lastVisitDates ?? {}

  const tonightEventsByVenue = useCallback((venueId: string) => {
    return events.filter(e => e.venue_id === venueId && isUpTonight(e))
  }, [events])

  const isVenueDimmed = useCallback((venue: Venue) => {
    if (activeFilters.size === 0) return false
    const tonightEvts = tonightEventsByVenue(venue.id)
    const venueEvents = events.filter(e => e.venue_id === venue.id)

    for (const f of activeFilters) {
      if (f === 'tonight' && tonightEvts.length === 0) return true
      if (f === 'under20' && !venueEvents.some(e => e.price_min !== null && e.price_min <= 20)) return true
      if (f === 'storefront' && venue.venue_type !== 'storefront') return true
      if (f === 'never' && (visitCounts[venue.id] ?? 0) > 0) return true
    }
    return false
  }, [activeFilters, events, tonightEventsByVenue, visitCounts])

  const filterCounts = {
    tonight: venues.filter(v => tonightEventsByVenue(v.id).length > 0).length,
    under20: venues.filter(v => events.some(e => e.venue_id === v.id && e.price_min !== null && e.price_min <= 20)).length,
    storefront: venues.filter(v => v.venue_type === 'storefront').length,
    never: venues.filter(v => (visitCounts[v.id] ?? 0) === 0).length,
    pwyc: venues.filter(v => v.pay_what_you_can_days && v.pay_what_you_can_days.length > 0).length,
  }

  useEffect(() => {
    if (!containerRef.current || !hasToken) return

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: CHICAGO_CENTER,
      zoom: 12,
      attributionControl: true,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.on('click', () => setSelectedVenue(null))

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [hasToken])

  useEffect(() => {
    const map = mapRef.current
    if (!map || venues.length === 0) return

    // Clear old markers
    for (const { marker } of markersRef.current.values()) marker.remove()
    markersRef.current.clear()

    for (const venue of venues) {
      if (venue.latitude == null || venue.longitude == null) continue

      const venueEvents = events.filter(e => e.venue_id === venue.id)
      const firstEventStatus = venueEvents.length > 0 ? getStatus(venueEvents[0].id) : null
      const tonightEvts = tonightEventsByVenue(venue.id)
      const dimmed = isVenueDimmed(venue)

      const el = createMarkerElement({
        venue,
        relationship: firstEventStatus,
        dominantColor: null,
        isTonight: tonightEvts.length > 0,
        isSelected: selectedVenue?.id === venue.id,
        dimmed,
        onClick: () => {
          setSelectedVenue(prev => prev?.id === venue.id ? null : venue)
          map.flyTo({ center: [venue.longitude!, venue.latitude!], zoom: 14, duration: 600 })
        },
      })

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([venue.longitude, venue.latitude])
        .addTo(map)

      markersRef.current.set(venue.id, { marker, el, venue })
    }
  }, [venues, events, activeFilters, selectedVenue, getStatus, tonightEventsByVenue, isVenueDimmed])

  if (!hasToken) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#141109', color: '#625b4c' }}>
        <div className="text-center p-6">
          <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>
            Map Coming Soon
          </p>
          <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: '#625b4c' }}>
            Add VITE_MAPBOX_TOKEN to .env.local
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <MapFilterChips
        activeFilters={activeFilters}
        onToggle={(f) => {
          setActiveFilters(prev => {
            const next = new Set(prev)
            if (next.has(f)) next.delete(f)
            else next.add(f)
            return next
          })
        }}
        counts={filterCounts}
      />

      <MapKey />

      <VenueSheet
        venue={selectedVenue}
        tonightEvents={selectedVenue ? tonightEventsByVenue(selectedVenue.id) : []}
        visitCount={selectedVenue ? (visitCounts[selectedVenue.id] ?? 0) : 0}
        lastVisitDate={selectedVenue ? (lastVisitDates[selectedVenue.id] ?? null) : null}
        allVenues={venues}
        allEvents={events}
        peekCounts={{ tonight: filterCounts.tonight, under20: filterCounts.under20, pwyc: filterCounts.pwyc }}
        onClose={() => setSelectedVenue(null)}
      />

      {/* OSM attribution */}
      <div
        style={{
          position: 'absolute',
          bottom: 'auto',
          top: 4,
          right: 4,
          fontFamily: "'Courier Prime', monospace",
          fontSize: 8,
          color: '#3f3a31',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        © OpenStreetMap contributors
      </div>

      <style>{`
        @keyframes tonight-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes tonight-pulse {
            0%, 100% { opacity: 1; }
          }
        }
      `}</style>
    </div>
  )
}
