import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { fetchVenueAuditRows, fetchEventVenueIds, buildAuditVenues } from '../lib/queries'
import { diagnoseVenue } from '../lib/diagnosis'
import type { Diagnosis } from '../lib/diagnosis'
import type { AuditVenue } from '../lib/types'

export interface AuditVenueRow extends AuditVenue {
  diagnosis: Diagnosis
  consecutive_failures: number
  domain: string | null
  has_open_suggestions: boolean
}

interface Filters {
  missingCalendar: boolean
  missingPhoto: boolean
  zeroEvents: boolean
  blocked: boolean
}

export function useVenueAudit() {
  const [sort, setSort] = useState('event_count_asc')
  const [filters, setFiltersState] = useState<Filters>({ missingCalendar: false, missingPhoto: false, zeroEvents: false, blocked: false })

  const venueQuery = useQuery({
    queryKey: queryKeys.venues.audit,
    queryFn: async () => {
      const [venueRows, eventCounts] = await Promise.all([
        fetchVenueAuditRows(),
        fetchEventVenueIds(),
      ])
      const venues = buildAuditVenues(venueRows, eventCounts)

      const { data: profiles } = await supabase
        .from('site_profiles')
        .select('domain, consecutive_failures')

      const failureMap = new Map<string, number>()
      for (const p of profiles ?? []) {
        if (p.domain && p.consecutive_failures > 0) failureMap.set(p.domain, p.consecutive_failures)
      }

      return venues.map((v): AuditVenueRow => {
        let domain: string | null = null
        if (v.website_url) {
          try {
            domain = v.website_url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase()
          } catch { /* */ }
        }
        const failures = domain ? (failureMap.get(domain) ?? 0) : 0

        return {
          ...v,
          diagnosis: diagnoseVenue({
            name: v.name,
            venue_type: v.venue_type,
            has_calendar_url: v.has_calendar_url,
            event_count: v.event_count,
            source: v.source,
            consecutive_failures: failures,
          }),
          consecutive_failures: failures,
          domain,
          has_open_suggestions: false,
        }
      })
    },
  })

  const setFilters = useCallback((partial: Partial<Filters>) => {
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
