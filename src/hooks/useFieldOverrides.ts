import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import type { FieldOverride } from '../lib/types'

export function useFieldOverrides(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.overrides.forEntity(entityType, entityId),
    queryFn: async () => {
      const { data } = await supabase
        .from('field_overrides')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
      return (data ?? []) as FieldOverride[]
    },
    enabled: !!entityId,
  })
}
