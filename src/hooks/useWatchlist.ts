import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { fetchWatchlist } from '../lib/queries'
import type { WatchlistItem, WatchlistStatus, Emotion, RoomVolume } from '../lib/types'

export function useWatchlist() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''
  const qk = queryKeys.watchlist.all(userId)

  const { data, isLoading, refetch } = useQuery({
    queryKey: qk,
    queryFn: () => fetchWatchlist(userId),
    enabled: !!user,
  })

  const items = data ?? []

  // ---- Add / upsert ----
  const addMutation = useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string
      status: WatchlistStatus
    }) => {
      if (!user) throw new Error('Not authenticated')
      const { data: row } = await supabase
        .from('watchlist')
        .upsert(
          { user_id: user.id, event_id: eventId, status, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,event_id' },
        )
        .select('*, event:events(*, venue:venues(*))')
        .maybeSingle()
      return row as WatchlistItem | null
    },
    onMutate: async ({ eventId, status }) => {
      await queryClient.cancelQueries({ queryKey: qk })
      const previous = queryClient.getQueryData<WatchlistItem[]>(qk)
      const optimistic: WatchlistItem = {
        id: crypto.randomUUID(),
        user_id: userId,
        event_id: eventId,
        status,
        emotions: [],
        room_volume: null,
        reflection: null,
        seen_date: null,
        performance_at: null,
        seat_note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      queryClient.setQueryData<WatchlistItem[]>(qk, (old) => {
        const without = (old ?? []).filter((i) => i.event_id !== eventId)
        return [optimistic, ...without]
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk, context.previous)
      }
    },
    onSuccess: (row, { eventId }) => {
      if (row) {
        queryClient.setQueryData<WatchlistItem[]>(qk, (old) => {
          const without = (old ?? []).filter((i) => i.event_id !== eventId)
          return [row, ...without]
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk })
    },
  })

  // ---- Update status ----
  const updateMutation = useMutation({
    mutationFn: async ({
      eventId,
      status,
      extra,
    }: {
      eventId: string
      status: WatchlistStatus
      extra?: {
        reflection?: string
        seen_date?: string
        emotions?: Emotion[]
        room_volume?: RoomVolume | null
      }
    }) => {
      if (!user) throw new Error('Not authenticated')
      const { data: row } = await supabase
        .from('watchlist')
        .update({ status, ...extra, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .select('*, event:events(*, venue:venues(*))')
        .maybeSingle()
      return row as WatchlistItem | null
    },
    onMutate: async ({ eventId, status, extra }) => {
      await queryClient.cancelQueries({ queryKey: qk })
      const previous = queryClient.getQueryData<WatchlistItem[]>(qk)
      queryClient.setQueryData<WatchlistItem[]>(qk, (old) =>
        (old ?? []).map((i) =>
          i.event_id === eventId ? ({ ...i, status, ...extra } as WatchlistItem) : i,
        ),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk, context.previous)
      }
    },
    onSuccess: (row, { eventId }) => {
      if (row) {
        queryClient.setQueryData<WatchlistItem[]>(qk, (old) =>
          (old ?? []).map((i) => (i.event_id === eventId ? row : i)),
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk })
    },
  })

  // ---- Remove ----
  const removeMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error('Not authenticated')
      await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', eventId)
    },
    onMutate: async (eventId) => {
      await queryClient.cancelQueries({ queryKey: qk })
      const previous = queryClient.getQueryData<WatchlistItem[]>(qk)
      queryClient.setQueryData<WatchlistItem[]>(qk, (old) =>
        (old ?? []).filter((i) => i.event_id !== eventId),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk })
    },
  })

  // ---- Public API wrappers (preserve signatures) ----
  const addToWatchlist = async (eventId: string, status: WatchlistStatus = 'want_to_see') => {
    await addMutation.mutateAsync({ eventId, status })
  }

  const updateStatus = async (
    eventId: string,
    status: WatchlistStatus,
    extra?: {
      reflection?: string
      seen_date?: string
      emotions?: Emotion[]
      room_volume?: RoomVolume | null
    },
  ) => {
    await updateMutation.mutateAsync({ eventId, status, extra })
  }

  const removeFromWatchlist = async (eventId: string) => {
    await removeMutation.mutateAsync(eventId)
  }

  const getStatus = useCallback(
    (eventId: string): WatchlistStatus | null => {
      return items.find((i) => i.event_id === eventId)?.status ?? null
    },
    [items],
  )

  return { items, loading: isLoading, addToWatchlist, updateStatus, removeFromWatchlist, getStatus, refetch }
}
