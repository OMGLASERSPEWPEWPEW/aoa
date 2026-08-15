import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { fetchDiscoveryQueue } from '../lib/queries'
import type { QueueItem } from '../lib/types'

interface UseDiscoveryQueueResult {
  items: QueueItem[]
  loading: boolean
  dismiss: (id: string, note?: string) => Promise<void>
  refetch: () => void
}

export function useDiscoveryQueue(): UseDiscoveryQueueResult {
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.discoveryQueue.all,
    queryFn: fetchDiscoveryQueue,
  })

  const dismissMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      await supabase
        .from('venue_discovery_queue')
        .update({ dedup_status: 'skipped', admin_notes: note ?? null })
        .eq('id', id)
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.discoveryQueue.all })
      const previous = queryClient.getQueryData<QueueItem[]>(queryKeys.discoveryQueue.all)
      queryClient.setQueryData<QueueItem[]>(
        queryKeys.discoveryQueue.all,
        (old) => old?.filter((i) => i.id !== id) ?? [],
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.discoveryQueue.all, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.discoveryQueue.all })
    },
  })

  const dismiss = async (id: string, note?: string) => {
    await dismissMutation.mutateAsync({ id, note })
  }

  return {
    items: data ?? [],
    loading: isLoading,
    dismiss,
    refetch,
  }
}
