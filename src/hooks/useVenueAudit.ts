import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { fetchVenueAuditRows, fetchEventVenueIds, buildAuditVenues } from '../lib/queries'
import type { AuditVenue } from '../lib/types'

interface UseVenueAuditResult {
  venues: AuditVenue[]
  loading: boolean
  sort: string
  setSort: (s: string) => void
  filters: { missingCalendar: boolean; missingPhoto: boolean; zeroEvents: boolean }
  setFilters: (f: Partial<UseVenueAuditResult['filters']>) => void
}

export function useVenueAudit(): UseVenueAuditResult {
  const [sort, setSort] = useState('event_count_asc')
  const [filters, setFiltersState] = useState({ missingCalendar: false, missingPhoto: false, zeroEvents: false })

  const venueQuery = useQuery({
    queryKey: queryKeys.venues.audit,
    queryFn: async () => {
      const [venueRows, eventCounts] = await Promise.all([
        fetchVenueAuditRows(),
        fetchEventVenueIds(),
      ])
      return buildAuditVenues(venueRows, eventCounts)
    },
  })

  const setFilters = useCallback((partial: Partial<typeof filters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
  }, [])

  const venues = useMemo(() => {
    let filtered = venueQuery.data ?? []
    if (filters.missingCalendar) filtered = filtered.filter((v) => !v.has_calendar_url)
    if (filters.missingPhoto) filtered = filtered.filter((v) => !v.has_photo)
    if (filters.zeroEvents) filtered = filtered.filter((v) => v.event_count === 0)

    const sorted = [...filtered]
    if (sort === 'event_count_asc') sorted.sort((a, b) => a.event_count - b.event_count)
    else if (sort === 'event_count_desc') sorted.sort((a, b) => b.event_count - a.event_count)
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))

    return sorted
  }, [venueQuery.data, filters, sort])

  return { venues, loading: venueQuery.isLoading, sort, setSort, filters, setFilters }
}
