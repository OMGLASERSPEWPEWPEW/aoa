import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { VENUE_FIELDS, SCHOOL_FIELDS } from '../lib/fieldMeta'
import { fieldState } from '../lib/fieldState'
import { invalidateAfterOverride } from '../lib/adminInvalidation'
import type { FieldOverride, CuratorSuggestion, AdminFieldModel } from '../lib/types'

export function useEntityDetail(entityType: 'venue' | 'school', id: string) {
  const qc = useQueryClient()
  const [edits, setEdits] = useState<Record<string, unknown>>({})

  const fields = entityType === 'venue' ? VENUE_FIELDS : SCHOOL_FIELDS
  const table = entityType === 'venue' ? 'venues' : 'schools'

  const entityQuery = useQuery({
    queryKey: entityType === 'venue' ? queryKeys.venues.detail(id) : queryKeys.schools.detail(id),
    queryFn: async () => {
      const { data } = await supabase.from(table).select('*').eq('id', id).single()
      return data
    },
    enabled: !!id,
  })

  const overridesQuery = useQuery({
    queryKey: queryKeys.overrides.forEntity(entityType, id),
    queryFn: async () => {
      const { data } = await supabase
        .from('field_overrides')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', id)
      return (data ?? []) as FieldOverride[]
    },
    enabled: !!id,
  })

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.suggestions.forEntity(entityType, id),
    queryFn: async () => {
      const { data } = await supabase
        .from('curator_suggestions')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', id)
        .in('status', ['open'])
      return (data ?? []) as CuratorSuggestion[]
    },
    enabled: !!id,
  })

  const adminFields: AdminFieldModel[] = useMemo(() => {
    if (!entityQuery.data) return []
    const entity = entityQuery.data as Record<string, unknown>
    const overrides = overridesQuery.data ?? []
    const suggestions = suggestionsQuery.data ?? []

    return fields.map((meta) => {
      const value = entity[meta.name]
      const override = overrides.find(o => o.field_name === meta.name) ?? null
      const suggestion = suggestions.find(s => s.field_name === meta.name) ?? null
      const state = fieldState(value, override)

      return {
        name: meta.name,
        label: meta.label,
        editor: meta.editor,
        value,
        state,
        override,
        consequence: meta.consequence ?? null,
        sourceLabel: null,
        suggestion,
        options: meta.options,
        maxLength: meta.maxLength,
        hint: meta.hint,
      }
    })
  }, [entityQuery.data, overridesQuery.data, suggestionsQuery.data, fields])

  const counts = useMemo(() => {
    let held = 0, empty = 0, notes = 0
    for (const f of adminFields) {
      if (f.state === 'held') held++
      if (f.state === 'empty') empty++
      if (f.suggestion) notes++
    }
    return { total: adminFields.length, held, empty, notes }
  }, [adminFields])

  const dirtyCount = Object.keys(edits).length

  const setEdit = useCallback((field: string, value: unknown) => {
    setEdits(prev => ({ ...prev, [field]: value }))
  }, [])

  const discard = useCallback(() => setEdits({}), [])

  const save = useCallback(async () => {
    for (const [field, value] of Object.entries(edits)) {
      await supabase.rpc('apply_field_override', {
        p_entity_type: entityType,
        p_entity_id: id,
        p_field: field,
        p_value: JSON.stringify(value),
      })
    }
    setEdits({})
    invalidateAfterOverride(qc, entityType, id)
  }, [edits, entityType, id, qc])

  return {
    entity: entityQuery.data ?? null,
    fields: adminFields,
    counts,
    lastCuratedAt: (entityQuery.data as Record<string, unknown>)?.scraped_at as string | null
      ?? (entityQuery.data as Record<string, unknown>)?.class_scraped_at as string | null
      ?? null,
    loading: entityQuery.isLoading || overridesQuery.isLoading,
    edits,
    setEdit,
    discard,
    save,
    dirtyCount,
  }
}
