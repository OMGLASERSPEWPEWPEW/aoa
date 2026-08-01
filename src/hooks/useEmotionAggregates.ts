import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { emotionBySlug } from '../lib/emotions'
import type { SpectrumSlice } from '../lib/types'

function currentSeason(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return year.toString()
}

export function useEmotionAggregates(mode: 'season' | 'all-time') {
  const { user } = useAuth()
  const [slices, setSlices] = useState<SpectrumSlice[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    async function load() {
      let query = supabase
        .from('profile_emotion_counts')
        .select('emotion, weight')
        .eq('user_id', user!.id)

      if (mode === 'season') {
        query = query.eq('season', currentSeason())
      }

      const { data } = await query

      if (!data || data.length === 0) {
        setSlices([])
        setTotalCards(0)
        setLoading(false)
        return
      }

      const totalWeight = data.reduce((s, r) => s + Number(r.weight), 0)
      setTotalCards(Math.ceil(totalWeight))

      const computed: SpectrumSlice[] = data
        .map(r => ({
          emotion: r.emotion as SpectrumSlice['emotion'],
          pct: totalWeight > 0 ? Math.round((Number(r.weight) / totalWeight) * 100) : 0,
        }))
        .filter(s => s.pct > 0)
        .sort((a, b) => b.pct - a.pct)

      setSlices(computed)
      setLoading(false)
    }

    load()
  }, [user, mode])

  return { slices, totalCards, loading }
}

export function personalInsight(slices: SpectrumSlice[]): string {
  if (slices.length === 0) return ''
  const top1 = emotionBySlug(slices[0].emotion)
  const top2 = slices.length > 1 ? emotionBySlug(slices[1].emotion) : null
  if (top1 && top2) {
    return `You are, statistically, a person who likes to be ${top1.label.toLowerCase()} and then ${top2.label.toLowerCase()}.`
  }
  if (top1) {
    return `Mostly ${top1.label.toLowerCase()}. That's your palette so far.`
  }
  return ''
}
