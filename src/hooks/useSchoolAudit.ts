import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { diagnoseSchool } from '../lib/diagnosis'
import type { Diagnosis } from '../lib/diagnosis'

export interface AuditSchoolRow {
  id: string
  name: string
  short_name: string
  neighborhood: string
  discipline: string
  price_band: string | null
  url: string | null
  session_count: number
  last_curated_at: string | null
  diagnosis: Diagnosis
  has_open_suggestions: boolean
  domain: string | null
  consecutive_failures: number
}

interface Filters {
  neverCurated: boolean
  noPhoto: boolean
  blocked: boolean
}

export function useSchoolAudit(enabled = true) {
  const [sort, setSort] = useState<string>('session_count_asc')
  const [filters, setFiltersState] = useState<Filters>({ neverCurated: false, noPhoto: false, blocked: false })

  const setFilters = useCallback((partial: Partial<Filters>) => {
    setFiltersState(prev => ({ ...prev, ...partial }))
  }, [])

  const query = useQuery({
    queryKey: queryKeys.schools.audit,
    queryFn: async () => {
      const { data: schools } = await supabase
        .from('schools')
        .select('id, name, short_name, neighborhood, discipline, price_band, url, photo_url')

      const { data: sessions } = await supabase
        .from('class_sessions')
        .select('school_id, scraped_at')

      const { data: profiles } = await supabase
        .from('site_profiles')
        .select('domain, consecutive_failures')

      const sessionCountMap = new Map<string, number>()
      const lastCuratedMap = new Map<string, string>()
      for (const s of sessions ?? []) {
        sessionCountMap.set(s.school_id, (sessionCountMap.get(s.school_id) ?? 0) + 1)
        if (s.scraped_at) {
          const existing = lastCuratedMap.get(s.school_id)
          if (!existing || s.scraped_at > existing) lastCuratedMap.set(s.school_id, s.scraped_at)
        }
      }

      const failureMap = new Map<string, number>()
      for (const p of profiles ?? []) {
        if (p.domain && p.consecutive_failures > 0) failureMap.set(p.domain, p.consecutive_failures)
      }

      return (schools ?? []).map((s: any): AuditSchoolRow => {
        const sessionCount = sessionCountMap.get(s.id) ?? 0
        const lastCurated = lastCuratedMap.get(s.id) ?? null
        let domain: string | null = null
        if (s.url) {
          try {
            domain = s.url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase()
          } catch { /* */ }
        }
        const failures = domain ? (failureMap.get(domain) ?? 0) : 0

        return {
          id: s.id,
          name: s.name,
          short_name: s.short_name,
          neighborhood: s.neighborhood,
          discipline: s.discipline,
          price_band: s.price_band,
          url: s.url,
          session_count: sessionCount,
          last_curated_at: lastCurated,
          diagnosis: diagnoseSchool({ name: s.name, session_count: sessionCount, last_curated_at: lastCurated, consecutive_failures: failures }),
          has_open_suggestions: false,
          domain,
          consecutive_failures: failures,
        }
      })
    },
    enabled,
  })

  const schools = useMemo(() => {
    let filtered = query.data ?? []
    if (filters.neverCurated) filtered = filtered.filter(s => s.session_count === 0)
    if (filters.noPhoto) filtered = filtered.filter(s => !s.url)

    const sorted = [...filtered]
    if (sort === 'session_count_asc') sorted.sort((a, b) => a.session_count - b.session_count)
    else if (sort === 'session_count_desc') sorted.sort((a, b) => b.session_count - a.session_count)
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))

    return sorted
  }, [query.data, filters, sort])

  return { schools, loading: query.isLoading, sort, setSort, filters, setFilters }
}
