import { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useWatchlist } from '../hooks/useWatchlist'
import { useLastScrape } from '../hooks/useLastScrape'
import { useClassMap } from '../hooks/useClassMap'
import { fetchMapData, mapDataQueryKey } from '../lib/mapData'
import { isEnrolling } from '../lib/classData'
import { createMarkerElement } from './MapMarker'
import { createClassMarkerElement } from './ClassMarker'
import { MapModeControl } from './MapModeControl'
import { MapModeFilters } from './MapModeFilters'
import { MapKey } from './MapKey'
import { VenueSheet } from './VenueSheet'
import { ClassSheet } from './ClassSheet'
import { isUpTonight, isThisWeek, isThisMonth } from '../lib/tonight'
import type { Venue, MapMode, SchoolWithSession, TimeFilter, Event } from '../lib/types'

const CHICAGO_CENTER: [number, number] = [-87.6298, 41.8781]

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const venueMarkersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; venue: Venue }>>(new Map())
  const classMarkersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; school: SchoolWithSession }>>(new Map())
  const markerClickedRef = useRef(false)
  const { user } = useAuth()
  const { resolved: theme } = useTheme()
  const { getStatus } = useWatchlist()

  const [mode, setMode] = useState<MapMode>('shows')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week')
  const [showFilters, setShowFilters] = useState<Set<string>>(new Set())
  const [classFilters, setClassFilters] = useState<Set<string>>(new Set())
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [selectedSchool, setSelectedSchool] = useState<SchoolWithSession | null>(null)

  const hasToken = !!import.meta.env.VITE_MAPBOX_TOKEN
  const lastScrapeTs = useLastScrape()

  const { data: mapData } = useQuery({
    queryKey: mapDataQueryKey(user?.id ?? null, lastScrapeTs),
    queryFn: () => fetchMapData(user?.id ?? null),
  })

  const { schools } = useClassMap()

  const venues = mapData?.venues ?? []
  const events = mapData?.events ?? []
  const visitCounts = mapData?.visitCounts ?? {}
  const venueEmotionColors = mapData?.venueEmotionColors ?? {}

  const activeFilters = mode === 'shows' ? showFilters : classFilters

  const timeFilterFn = useCallback((e: Event) => {
    if (timeFilter === 'today') return isUpTonight(e)
    if (timeFilter === 'week') return isThisWeek(e)
    return isThisMonth(e)
  }, [timeFilter])

  const venueIdsInTimeWindow = new Set(
    events.filter(timeFilterFn).map(e => e.venue_id)
  )

  const tonightEventsByVenue = useCallback((venueId: string) => {
    return events.filter(e => e.venue_id === venueId && isUpTonight(e))
  }, [events])

  const isVenueDimmed = useCallback((venue: Venue) => {
    if (showFilters.size === 0) return false
    const venueEvents = events.filter(e => e.venue_id === venue.id)

    for (const f of showFilters) {
      if (f === 'tonight' && !venueEvents.some(e => isUpTonight(e))) return true
      if (f === 'under20' && !venueEvents.some(e => e.price_min !== null && e.price_min <= 20)) return true
      if (f === 'never' && (visitCounts[venue.id] ?? 0) > 0) return true
    }
    return false
  }, [showFilters, events, visitCounts])

  const isSchoolDimmed = useCallback((school: SchoolWithSession) => {
    if (classFilters.size === 0) return false
    const session = school.next_session

    for (const f of classFilters) {
      if (f === 'enrolling' && !isEnrolling(session)) return true
      if (f === 'drop_in' && !session?.drop_in) return true
      if (f === 'no_experience' && !session?.no_experience) return true
    }
    return false
  }, [classFilters])

  // Time-filtered venues (only venues with events in the selected time window)
  const showVenues = venues.filter(v =>
    v.latitude != null && v.longitude != null &&
    venueIdsInTimeWindow.has(v.id)
  )

  const timePillCounts = {
    today: new Set(events.filter(e => isUpTonight(e)).map(e => e.venue_id)).size,
    week: new Set(events.filter(e => isThisWeek(e)).map(e => e.venue_id)).size,
    month: new Set(events.filter(e => isThisMonth(e)).map(e => e.venue_id)).size,
  }

  const showFilterCounts = {
    tonight: showVenues.filter(v => tonightEventsByVenue(v.id).length > 0).length,
    under20: showVenues.filter(v => events.some(e => e.venue_id === v.id && e.price_min !== null && e.price_min <= 20)).length,
    never: showVenues.filter(v => (visitCounts[v.id] ?? 0) === 0).length,
  }

  const classFilterCounts = {
    enrolling: schools.filter(s => isEnrolling(s.next_session)).length,
    drop_in: schools.filter(s => s.next_session?.drop_in).length,
    no_experience: schools.filter(s => s.next_session?.no_experience).length,
  }

  const filterCounts = mode === 'shows' ? showFilterCounts : classFilterCounts

  // Map init
  useEffect(() => {
    if (!containerRef.current || !hasToken) return

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: `mapbox://styles/mapbox/${theme}-v11`,
      center: CHICAGO_CENTER,
      zoom: 12,
      attributionControl: true,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.on('error', (e) => console.error('[mapbox]', e.error?.message ?? e))
    map.on('click', () => {
      if (markerClickedRef.current) {
        markerClickedRef.current = false
        return
      }
      setSelectedVenue(null)
      setSelectedSchool(null)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      venueMarkersRef.current.clear()
      classMarkersRef.current.clear()
    }
  }, [hasToken])

  // Render venue markers (shows mode only)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const { marker } of venueMarkersRef.current.values()) marker.remove()
    venueMarkersRef.current.clear()

    if (mode !== 'shows' || venues.length === 0) return

    for (const venue of showVenues) {
      const venueEvents = events.filter(e => e.venue_id === venue.id)
      const firstEventStatus = venueEvents.length > 0 ? getStatus(venueEvents[0].id) : null
      const tonightEvts = tonightEventsByVenue(venue.id)
      const dimmed = isVenueDimmed(venue)

      const el = createMarkerElement({
        venue,
        relationship: firstEventStatus,
        dominantColor: venueEmotionColors[venue.id] ?? null,
        isTonight: tonightEvts.length > 0,
        isSelected: selectedVenue?.id === venue.id,
        dimmed,
        hasClassEvents: false,
        onClick: () => {
          markerClickedRef.current = true
          setSelectedVenue(prev => prev?.id === venue.id ? null : venue)
          setSelectedSchool(null)
          map.flyTo({ center: [Number(venue.longitude!), Number(venue.latitude!)], zoom: 14, duration: 600 })
        },
      })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([Number(venue.longitude), Number(venue.latitude)])
        .addTo(map)

      venueMarkersRef.current.set(venue.id, { marker, el, venue })
    }
  }, [venues, events, showFilters, getStatus, tonightEventsByVenue, isVenueDimmed, venueEmotionColors, mode, selectedVenue, timeFilter])

  // Render class markers (classes mode only)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const { marker } of classMarkersRef.current.values()) marker.remove()
    classMarkersRef.current.clear()

    if (mode !== 'classes' || schools.length === 0) return

    for (const school of schools) {
      const dimmed = isSchoolDimmed(school)

      const el = createClassMarkerElement({
        school,
        isSelected: selectedSchool?.id === school.id,
        dimmed,
        onClick: () => {
          markerClickedRef.current = true
          setSelectedSchool(prev => prev?.id === school.id ? null : school)
          setSelectedVenue(null)
          map.flyTo({ center: [school.longitude, school.latitude], zoom: 14, duration: 600 })
        },
      })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([school.longitude, school.latitude])
        .addTo(map)

      classMarkersRef.current.set(school.id, { marker, el, school })
    }
  }, [schools, classFilters, isSchoolDimmed, mode, selectedSchool])

  // Theme change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(`mapbox://styles/mapbox/${theme}-v11`)
  }, [theme])

  // Selected state styling for venue markers
  useEffect(() => {
    for (const [id, { el }] of venueMarkersRef.current) {
      const selected = selectedVenue?.id === id
      const chip = el.querySelector('.chip') as HTMLElement | null
      if (chip) {
        chip.style.transform = selected ? 'scale(1.18)' : 'scale(1)'
        chip.style.boxShadow = selected
          ? '0 3px 8px rgba(0,0,0,.7), 0 0 12px var(--accent)'
          : '0 3px 8px rgba(0,0,0,.7)'
      }
    }
  }, [selectedVenue])

  if (!hasToken) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--ink-faint)' }}>
        <div className="text-center p-6">
          <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>
            Map Coming Soon
          </p>
          <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: 'var(--ink-faint)' }}>
            Add VITE_MAPBOX_TOKEN to .env.local
          </p>
        </div>
      </div>
    )
  }

  const isMarkerSelected = selectedVenue !== null || selectedSchool !== null

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />

      {/* Mode control — centered top */}
      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 1050 }}>
        <MapModeControl
          mode={mode}
          onModeChange={(m) => {
            setMode(m)
            setSelectedVenue(null)
            setSelectedSchool(null)
          }}
          showCount={showVenues.length}
          classCount={schools.length}
        />
      </div>

      {/* Time pills — shows mode only */}
      {mode === 'shows' && (
        <div style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 1050, padding: '0 14px', display: 'flex', gap: 6, justifyContent: 'center' }}>
          {([['today', 'TODAY'], ['week', 'THIS WEEK'], ['month', 'THIS MONTH']] as const).map(([key, label]) => {
            const active = timeFilter === key
            return (
              <button
                key={key}
                onClick={() => setTimeFilter(key)}
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 9.5,
                  letterSpacing: '0.08em',
                  padding: '5px 10px',
                  borderRadius: 3,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--rule)',
                  background: active ? 'var(--accent)' : 'color-mix(in srgb, var(--bg) 90%, transparent)',
                  color: active ? 'var(--accent-on)' : 'var(--ink-dim)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                }}
              >
                {label}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", marginLeft: 4, opacity: 0.7 }}>
                  {timePillCounts[key]}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Contextual filters — below time pills (shows) or below mode control (classes) */}
      <div style={{ position: 'absolute', top: mode === 'shows' ? 92 : 56, left: 0, right: 0, zIndex: 1050, padding: '0 14px' }}>
        <MapModeFilters
          mode={mode}
          activeFilters={activeFilters}
          onToggle={(f) => {
            if (mode === 'shows') {
              setShowFilters(prev => {
                const next = new Set(prev)
                if (next.has(f)) next.delete(f)
                else next.add(f)
                return next
              })
            } else {
              setClassFilters(prev => {
                const next = new Set(prev)
                if (next.has(f)) next.delete(f)
                else next.add(f)
                return next
              })
            }
          }}
          counts={filterCounts}
        />
      </div>

      <MapKey mode={mode} isMarkerSelected={isMarkerSelected} />

      {/* Venue sheet (shows mode) */}
      {selectedVenue && mode === 'shows' && (
        <VenueSheet
          venue={selectedVenue}
          tonightEvents={tonightEventsByVenue(selectedVenue.id)}
          visitCount={visitCounts[selectedVenue.id] ?? 0}
          lastVisitDate={mapData?.lastVisitDates?.[selectedVenue.id] ?? null}
          allVenues={venues}
          allEvents={events}
          onClose={() => setSelectedVenue(null)}
        />
      )}

      {/* Class sheet (classes mode) */}
      {selectedSchool && mode === 'classes' && (
        <ClassSheet
          school={selectedSchool}
          allSchools={schools}
          onClose={() => setSelectedSchool(null)}
          onSelectSchool={(s) => {
            setSelectedSchool(s)
            mapRef.current?.flyTo({ center: [s.longitude, s.latitude], zoom: 14, duration: 600 })
          }}
        />
      )}

      {/* OSM attribution */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          fontFamily: "'Courier Prime', monospace",
          fontSize: 8,
          color: 'var(--ink-whisper)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        © OpenStreetMap contributors
      </div>
    </div>
  )
}
