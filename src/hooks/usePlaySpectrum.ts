import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { SpectrumSlice } from '../lib/types'

export interface UsePlaySpectrumResult {
  slices: SpectrumSlice[]
  totalCards: number
  loading: boolean
}

export function usePlaySpectrum(playId: string): UsePlaySpectrumResult {
  const [slices, setSlices] = useState<SpectrumSlice[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playId) return

    async function load() {
      setLoading(true)

      const [specRes, totalRes] = await Promise.all([
        supabase
          .from('play_spectrum')
          .select('emotion, pct')
          .eq('play_id', playId),
        supabase
          .from('play_emotion_counts')
          .select('weight')
          .eq('play_id', playId),
      ])

      if (specRes.data && specRes.data.length > 0) {
        setSlices(
          (specRes.data as { emotion: string; pct: number }[])
            .map(r => ({ emotion: r.emotion as SpectrumSlice['emotion'], pct: r.pct }))
            .sort((a, b) => b.pct - a.pct)
        )
      } else {
        setSlices([])
      }

      if (totalRes.data && totalRes.data.length > 0) {
        setTotalCards(
          Math.round((totalRes.data as { weight: number }[]).reduce((sum, r) => sum + r.weight, 0))
        )
      } else {
        setTotalCards(0)
      }

      setLoading(false)
    }

    load()
  }, [playId])

  return { slices, totalCards, loading }
}
