import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Review } from '../lib/types'

export function useReviews(eventId: string) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*, profile:profiles(id, username, belt_level)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    setReviews((data as Review[]) ?? [])
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const submitReview = useCallback(async (review: {
    rating: number
    title: string
    body: string
    contains_spoilers: boolean
  }) => {
    if (!user) return
    await supabase.from('reviews').insert({
      user_id: user.id,
      event_id: eventId,
      ...review,
    })
    await fetchReviews()
  }, [user, eventId, fetchReviews])

  const deleteReview = useCallback(async (reviewId: string) => {
    await supabase.from('reviews').delete().eq('id', reviewId)
    await fetchReviews()
  }, [fetchReviews])

  const voteHelpful = useCallback(async (reviewId: string) => {
    await supabase.rpc('increment_helpful_count', { review_id: reviewId })
    await fetchReviews()
  }, [fetchReviews])

  const userReview = reviews.find(r => r.user_id === user?.id) ?? null

  return { reviews, loading, submitReview, deleteReview, voteHelpful, userReview, refetch: fetchReviews }
}
