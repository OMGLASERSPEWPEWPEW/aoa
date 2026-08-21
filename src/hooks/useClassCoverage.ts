import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import type { ClassCoverageMetrics } from '../lib/types'

export function useClassCoverage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.schools.coverage,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_class_coverage_metrics')
      if (error) throw error
      return data as ClassCoverageMetrics
    },
  })

  return {
    metrics: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  }
}
