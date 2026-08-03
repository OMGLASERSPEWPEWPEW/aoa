import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { WatchlistItem, WatchlistStatus, Emotion, RoomVolume } from '../lib/types'

export function useWatchlist() {
  const { user } = useAuth()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWatchlist = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('watchlist')
      .select('*, event:events(*, venue:venues(*))')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setItems((data as WatchlistItem[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])

  const addToWatchlist = useCallback(async (eventId: string, status: WatchlistStatus = 'want_to_see') => {
    if (!user) return
    const optimistic: WatchlistItem = {
      id: crypto.randomUUID(),
      user_id: user.id,
      event_id: eventId,
      status,
      updated_at: new Date().toISOString(),
    } as WatchlistItem
    setItems(prev => [optimistic, ...prev.filter(i => i.event_id !== eventId)])
    try {
      const { data } = await supabase
        .from('watchlist')
        .upsert(
          { user_id: user.id, event_id: eventId, status, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,event_id' },
        )
        .select('*, event:events(*, venue:venues(*))')
        .maybeSingle()
      if (data) {
        setItems(prev => {
          const without = prev.filter(i => i.event_id !== eventId)
          return [data as WatchlistItem, ...without]
        })
      }
    } catch {
      setItems(prev => prev.filter(i => i.id !== optimistic.id))
    }
  }, [user])

  const updateStatus = useCallback(async (eventId: string, status: WatchlistStatus, extra?: { reflection?: string; seen_date?: string; emotions?: Emotion[]; room_volume?: RoomVolume | null }) => {
    if (!user) return
    const prev = items
    setItems(p => p.map(i => i.event_id === eventId ? { ...i, status, ...extra } as WatchlistItem : i))
    try {
      const { data } = await supabase
        .from('watchlist')
        .update({ status, ...extra, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .select('*, event:events(*, venue:venues(*))')
        .maybeSingle()
      if (data) {
        setItems(p => p.map(i => i.event_id === eventId ? data as WatchlistItem : i))
      }
    } catch {
      setItems(prev)
    }
  }, [user, items])

  const removeFromWatchlist = useCallback(async (eventId: string) => {
    if (!user) return
    await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('event_id', eventId)
    setItems(prev => prev.filter(i => i.event_id !== eventId))
  }, [user])

  const getStatus = useCallback((eventId: string): WatchlistStatus | null => {
    return items.find(i => i.event_id === eventId)?.status ?? null
  }, [items])

  return { items, loading, addToWatchlist, updateStatus, removeFromWatchlist, getStatus, refetch: fetchWatchlist }
}
