import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { HouseRank } from '../lib/house'

export function useHouseCheck() {
  const [rankUp, setRankUp] = useState<HouseRank | null>(null)

  const checkRank = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await supabase.functions.invoke('house-check', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (res.data?.advanced && res.data.newRank != null) {
      setRankUp(res.data.newRank as HouseRank)
    }
  }, [])

  const dismissRankUp = useCallback(() => {
    setRankUp(null)
  }, [])

  return { rankUp, checkRank, dismissRankUp }
}
