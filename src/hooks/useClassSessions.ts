import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { groupSessions } from '../lib/classGrouping'
import { sessionDiagnosis } from '../lib/classDiagnosis'
import type { ClassSession, ClassSessionRow, ClassGroup, FieldOverride } from '../lib/types'

const STORAGE_KEY = (schoolId: string) => `aoa.classGroups.${schoolId}`

function loadCollapsed(schoolId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY(schoolId))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveCollapsed(schoolId: string, keys: Set<string>) {
  sessionStorage.setItem(STORAGE_KEY(schoolId), JSON.stringify([...keys]))
}

export function useClassSessions(schoolId: string) {
  const [collapsedKeys, setCollapsedKeys] = useState(() => loadCollapsed(schoolId))

  const sessionsQuery = useQuery({
    queryKey: queryKeys.classSessions.forSchool(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('starts_on', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
      if (error) throw error
      return data as ClassSession[]
    },
    enabled: !!schoolId,
  })

  const overridesQuery = useQuery({
    queryKey: ['class-session-overrides', schoolId],
    queryFn: async () => {
      const sessionIds = sessionsQuery.data?.map(s => s.id) ?? []
      if (sessionIds.length === 0) return []
      const { data, error } = await supabase
        .from('field_overrides')
        .select('*')
        .eq('entity_type', 'class_session')
        .in('entity_id', sessionIds)
      if (error) throw error
      return data as FieldOverride[]
    },
    enabled: !!sessionsQuery.data && sessionsQuery.data.length > 0,
  })

  const rows: ClassSessionRow[] = useMemo(() => {
    if (!sessionsQuery.data) return []
    const allOverrides = overridesQuery.data ?? []

    return sessionsQuery.data.map((s): ClassSessionRow => {
      const sessionOverrides: Record<string, FieldOverride> = {}
      for (const o of allOverrides) {
        if (o.entity_id === s.id) sessionOverrides[o.field_name] = o
      }
      return {
        ...s,
        overrides: sessionOverrides,
        diagnosis: sessionDiagnosis(s),
      }
    })
  }, [sessionsQuery.data, overridesQuery.data])

  const groups: ClassGroup[] = useMemo(
    () => groupSessions(rows, collapsedKeys),
    [rows, collapsedKeys],
  )

  const totalCount = rows.length
  const problemCount = rows.filter(r => r.diagnosis.problems.includes('wont_show')).length

  const lastCuratedAt = useMemo(() => {
    let latest: string | null = null
    for (const r of rows) {
      if (r.scraped_at && (!latest || r.scraped_at > latest)) latest = r.scraped_at
    }
    return latest
  }, [rows])

  const completeness = useMemo(() => {
    if (rows.length === 0) return 0
    let filled = 0
    let total = 0
    const checkFields = ['starts_on', 'price', 'level', 'instructor_name'] as const
    for (const r of rows) {
      for (const f of checkFields) {
        total++
        if (r[f] != null && r[f] !== '') filled++
      }
    }
    return total > 0 ? filled / total : 0
  }, [rows])

  const toggleGroup = useCallback((key: string) => {
    setCollapsedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveCollapsed(schoolId, next)
      return next
    })
  }, [schoolId])

  return {
    groups,
    totalCount,
    problemCount,
    lastCuratedAt,
    completeness,
    loading: sessionsQuery.isLoading,
    toggleGroup,
  }
}
