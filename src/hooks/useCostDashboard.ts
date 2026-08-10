import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface CostByModel {
  model: string
  call_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
}

interface CostByFeature {
  feature: string
  call_count: number
  total_cost: number
}

interface DailyCost {
  day: string
  call_count: number
  total_cost: number
}

export interface CostDashboard {
  total: number
  byModel: CostByModel[]
  byFeature: CostByFeature[]
  dailySeries: DailyCost[]
  loading: boolean
}

export function useCostDashboard(days: number = 7): CostDashboard {
  const { user } = useAuth()
  const [data, setData] = useState<CostDashboard>({
    total: 0,
    byModel: [], byFeature: [], dailySeries: [],
    loading: true,
  })

  useEffect(() => {
    if (!user) return

    async function load() {
      const dailyDays = Math.min(days, 30)
      const [totalRes, modelRes, featureRes, dailyRes] = await Promise.all([
        supabase.rpc('get_ai_cost_total', { p_days: days }),
        supabase.rpc('get_ai_cost_by_model', { p_days: days }),
        supabase.rpc('get_ai_cost_by_feature', { p_days: days }),
        supabase.rpc('get_ai_daily_cost', { p_days: dailyDays }),
      ])

      setData({
        total: Number(totalRes.data ?? 0),
        byModel: modelRes.data ?? [],
        byFeature: featureRes.data ?? [],
        dailySeries: (dailyRes.data ?? []).reverse(),
        loading: false,
      })
    }

    load()
  }, [user, days])

  return data
}
