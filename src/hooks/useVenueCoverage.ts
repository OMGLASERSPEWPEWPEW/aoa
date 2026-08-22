import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { fetchVenueCoverage } from '../lib/queries'
import type { VenueCoverageMetrics } from '../../supabase/functions/_shared/scraper/types'

interface UseCoverageResult {
  metrics: VenueCoverageMetrics | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useVenueCoverage(enabled = true): UseCoverageResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.venues.coverage,
    queryFn: fetchVenueCoverage,
    enabled,
  })

  return {
    metrics: data?.data ?? null,
    loading: isLoading,
    error: data?.error ?? error?.message ?? null,
    refetch,
  }
}
