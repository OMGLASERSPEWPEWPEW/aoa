import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { fetchCostDashboard } from '../lib/queries'
import type { CostDashboard } from '../lib/types'

export function useCostDashboard(days: number = 7): CostDashboard {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.cost.dashboard(days),
    queryFn: () => fetchCostDashboard(days),
    enabled: !!user,
  })

  return {
    total: data?.total ?? 0,
    byModel: data?.byModel ?? [],
    byFeature: data?.byFeature ?? [],
    dailySeries: data?.dailySeries ?? [],
    loading: isLoading,
  }
}
