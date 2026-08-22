import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { invalidateAfterOverride } from '../lib/adminInvalidation'
import type { CuratorSuggestion } from '../lib/types'

export function useCuratorSuggestions(entityType: string, entityId: string) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.suggestions.forEntity(entityType, entityId),
    queryFn: async () => {
      const { data } = await supabase
        .from('curator_suggestions')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .in('status', ['open'])
      return (data ?? []) as CuratorSuggestion[]
    },
    enabled: !!entityId,
  })

  const accept = useCallback(async (suggestionId: string) => {
    await supabase.rpc('accept_suggestion', { p_id: suggestionId })
    invalidateAfterOverride(qc, entityType, entityId)
    qc.invalidateQueries({ queryKey: queryKeys.suggestions.forEntity(entityType, entityId) })
  }, [qc, entityType, entityId])

  const dismiss = useCallback(async (suggestionId: string) => {
    await supabase.rpc('dismiss_suggestion', { p_id: suggestionId })
    qc.invalidateQueries({ queryKey: queryKeys.suggestions.forEntity(entityType, entityId) })
  }, [qc, entityType, entityId])

  const dismissAll = useCallback(async () => {
    for (const s of query.data ?? []) {
      await supabase.rpc('dismiss_suggestion', { p_id: s.id })
    }
    qc.invalidateQueries({ queryKey: queryKeys.suggestions.forEntity(entityType, entityId) })
  }, [qc, entityType, entityId, query.data])

  return {
    suggestions: query.data ?? [],
    loading: query.isLoading,
    accept,
    dismiss,
    dismissAll,
  }
}
