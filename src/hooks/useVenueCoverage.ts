import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { VenueCoverageMetrics } from '../../supabase/functions/_shared/scraper/types'

interface UseCoverageResult {
  metrics: VenueCoverageMetrics | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useVenueCoverage(): UseCoverageResult {
  const [metrics, setMetrics] = useState<VenueCoverageMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('get_venue_coverage_metrics')
    if (err) {
      setError(err.message)
    } else {
      setMetrics(data as VenueCoverageMetrics)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { metrics, loading, error, refetch: load }
}
