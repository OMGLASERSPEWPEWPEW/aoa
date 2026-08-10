import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface AuditVenue {
  id: string
  name: string
  neighborhood: string | null
  venue_type: string
  has_calendar_url: boolean
  has_photo: boolean
  event_count: number
  source: string
}

interface UseVenueAuditResult {
  venues: AuditVenue[]
  loading: boolean
  sort: string
  setSort: (s: string) => void
  filters: { missingCalendar: boolean; missingPhoto: boolean; zeroEvents: boolean }
  setFilters: (f: Partial<UseVenueAuditResult['filters']>) => void
}

export function useVenueAudit(): UseVenueAuditResult {
  const [venues, setVenues] = useState<AuditVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('event_count_asc')
  const [filters, setFiltersState] = useState({ missingCalendar: false, missingPhoto: false, zeroEvents: false })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: venueRows } = await supabase
      .from('venues')
      .select('id, name, neighborhood, venue_type, calendar_url, photo_url, source')

    const { data: eventCounts } = await supabase
      .from('events')
      .select('venue_id')

    const countMap = new Map<string, number>()
    if (eventCounts) {
      for (const e of eventCounts) {
        countMap.set(e.venue_id, (countMap.get(e.venue_id) ?? 0) + 1)
      }
    }

    const mapped: AuditVenue[] = (venueRows ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      neighborhood: v.neighborhood,
      venue_type: v.venue_type,
      has_calendar_url: !!v.calendar_url,
      has_photo: !!v.photo_url,
      event_count: countMap.get(v.id) ?? 0,
      source: v.source ?? 'manual',
    }))

    setVenues(mapped)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setFilters = useCallback((partial: Partial<typeof filters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
  }, [])

  let filtered = venues
  if (filters.missingCalendar) filtered = filtered.filter((v) => !v.has_calendar_url)
  if (filters.missingPhoto) filtered = filtered.filter((v) => !v.has_photo)
  if (filters.zeroEvents) filtered = filtered.filter((v) => v.event_count === 0)

  if (sort === 'event_count_asc') filtered.sort((a, b) => a.event_count - b.event_count)
  else if (sort === 'event_count_desc') filtered.sort((a, b) => b.event_count - a.event_count)
  else if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name))

  return { venues: filtered, loading, sort, setSort, filters, setFilters }
}
