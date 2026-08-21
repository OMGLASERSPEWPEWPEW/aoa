import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

export function invalidateAfterBlock(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.blocked.all })
  qc.invalidateQueries({ queryKey: queryKeys.blocked.count })
  qc.invalidateQueries({ queryKey: queryKeys.venues.coverage })
  qc.invalidateQueries({ queryKey: queryKeys.venues.audit })
  qc.invalidateQueries({ queryKey: queryKeys.schools.coverage })
  qc.invalidateQueries({ queryKey: queryKeys.schools.audit })
  // Prefix invalidation for map layers
  qc.invalidateQueries({ queryKey: ['map-data'] })
  qc.invalidateQueries({ queryKey: ['class-map'] })
}

export function invalidateAfterOverride(qc: QueryClient, entityType: string, entityId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.overrides.forEntity(entityType, entityId) })
  if (entityType === 'venue') {
    qc.invalidateQueries({ queryKey: queryKeys.venues.detail(entityId) })
    qc.invalidateQueries({ queryKey: queryKeys.venues.audit })
  } else {
    qc.invalidateQueries({ queryKey: queryKeys.schools.detail(entityId) })
    qc.invalidateQueries({ queryKey: queryKeys.schools.audit })
  }
  qc.invalidateQueries({ queryKey: ['map-data'] })
  qc.invalidateQueries({ queryKey: ['class-map'] })
}
