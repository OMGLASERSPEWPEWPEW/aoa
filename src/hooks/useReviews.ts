import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { fetchReviewsByEvent } from '../lib/queries'

export function useReviews(eventId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.reviews.byEvent(eventId),
    queryFn: () => fetchReviewsByEvent(eventId),
    enabled: !!eventId,
  })

  const reviews = data ?? []

  const submitMutation = useMutation({
    mutationFn: async (review: {
      title: string
      body: string
      contains_spoilers: boolean
      emotions?: string[]
      prompt?: string
    }) => {
      if (!user) throw new Error('Not authenticated')
      await supabase.from('reviews').insert({
        user_id: user.id,
        event_id: eventId,
        ...review,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byEvent(eventId) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      await supabase.from('reviews').delete().eq('id', reviewId)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byEvent(eventId) })
    },
  })

  const voteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      await supabase.rpc('increment_helpful_count', { review_id: reviewId })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byEvent(eventId) })
    },
  })

  const submitReview = async (review: {
    title: string
    body: string
    contains_spoilers: boolean
    emotions?: string[]
    prompt?: string
  }) => {
    await submitMutation.mutateAsync(review)
  }

  const deleteReview = async (reviewId: string) => {
    await deleteMutation.mutateAsync(reviewId)
  }

  const voteHelpful = async (reviewId: string) => {
    await voteMutation.mutateAsync(reviewId)
  }

  const userReview = reviews.find((r) => r.user_id === user?.id) ?? null

  return { reviews, loading: isLoading, submitReview, deleteReview, voteHelpful, userReview, refetch }
}
