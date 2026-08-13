import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Artist, Credit, SpectrumSlice } from '../lib/types'

interface ArtistState {
  artist: Artist | null
  credits: Credit[]
  spectrum: SpectrumSlice[]
  totalCards: number
  isFollowing: boolean
  userSeenCount: number
  loading: boolean
  toggleFollow: () => Promise<void>
}

export function useArtist(artistId: string | undefined): ArtistState {
  const { user } = useAuth()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [credits, setCredits] = useState<Credit[]>([])
  const [spectrum, setSpectrum] = useState<SpectrumSlice[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [userSeenCount, setUserSeenCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!artistId) return

    async function fetch() {
      setLoading(true)

      const [artistRes, creditsRes, spectrumRes] = await Promise.all([
        supabase.from('artists').select('*').eq('id', artistId!).single(),
        supabase
          .from('credits')
          .select('*, event:events(*, venue:venues(*))')
          .eq('artist_id', artistId!)
          .order('created_at', { ascending: false }),
        supabase
          .from('artist_emotion_counts')
          .select('emotion, weight')
          .eq('artist_id', artistId!),
      ])

      if (artistRes.data) setArtist(artistRes.data as Artist)
      if (creditsRes.data) setCredits(creditsRes.data as Credit[])

      if (spectrumRes.data) {
        const totalWeight = (spectrumRes.data as { emotion: string; weight: number }[])
          .reduce((sum, r) => sum + r.weight, 0)
        const slices = (spectrumRes.data as { emotion: string; weight: number }[])
          .map(r => ({
            emotion: r.emotion as SpectrumSlice['emotion'],
            pct: totalWeight > 0 ? Math.round((r.weight / totalWeight) * 100) : 0,
          }))
          .sort((a, b) => b.pct - a.pct)
        setSpectrum(slices)
        setTotalCards(Math.round(totalWeight))
      }

      if (user) {
        const [followRes, seenRes] = await Promise.all([
          supabase
            .from('artist_follows')
            .select('artist_id')
            .eq('user_id', user.id)
            .eq('artist_id', artistId!)
            .maybeSingle(),
          supabase
            .from('watchlist_items')
            .select('id, event_id')
            .eq('user_id', user.id)
            .eq('status', 'seen')
            .in('event_id', (creditsRes.data ?? []).map((c: Credit) => c.event_id)),
        ])
        setIsFollowing(!!followRes.data)
        setUserSeenCount(seenRes.data?.length ?? 0)
      }

      setLoading(false)
    }

    fetch()
  }, [artistId, user])

  const toggleFollow = useCallback(async () => {
    if (!user || !artistId) return

    if (isFollowing) {
      setIsFollowing(false)
      await supabase
        .from('artist_follows')
        .delete()
        .eq('user_id', user.id)
        .eq('artist_id', artistId)
    } else {
      setIsFollowing(true)
      await supabase
        .from('artist_follows')
        .insert({ user_id: user.id, artist_id: artistId })
    }
  }, [user, artistId, isFollowing])

  return { artist, credits, spectrum, totalCards, isFollowing, userSeenCount, loading, toggleFollow }
}
