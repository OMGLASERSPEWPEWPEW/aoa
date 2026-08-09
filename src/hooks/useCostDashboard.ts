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
  today: number
  rolling7d: number
  rolling30d: number
  byModel: CostByModel[]
  byFeature: CostByFeature[]
  dailySeries: DailyCost[]
  loading: boolean
}

export function useCostDashboard(): CostDashboard {
  const { user } = useAuth()
  const [data, setData] = useState<CostDashboard>({
    today: 0, rolling7d: 0, rolling30d: 0,
    byModel: [], byFeature: [], dailySeries: [],
    loading: true,
  })

  useEffect(() => {
    if (!user) return

    async function load() {
      const [todayRes, weekRes, monthRes, modelRes, featureRes, dailyRes] = await Promise.all([
        supabase.rpc('get_ai_cost_total', { p_days: 1 }),
        supabase.rpc('get_ai_cost_total', { p_days: 7 }),
        supabase.rpc('get_ai_cost_total', { p_days: 30 }),
        supabase.rpc('get_ai_cost_by_model', { p_days: 30 }),
        supabase.rpc('get_ai_cost_by_feature', { p_days: 30 }),
        supabase.rpc('get_ai_daily_cost', { p_days: 14 }),
      ])

      setData({
        today: Number(todayRes.data ?? 0),
        rolling7d: Number(weekRes.data ?? 0),
        rolling30d: Number(monthRes.data ?? 0),
        byModel: modelRes.data ?? [],
        byFeature: featureRes.data ?? [],
        dailySeries: (dailyRes.data ?? []).reverse(),
        loading: false,
      })
    }

    load()
  }, [user])

  return data
}
