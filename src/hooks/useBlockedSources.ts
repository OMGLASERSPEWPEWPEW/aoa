import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import type { BlockedSource } from '../lib/types'

export function useBlockedSources() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.blocked.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_sources')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as BlockedSource[]
    },
  })

  return {
    items: data ?? [],
    count: data?.length ?? 0,
    loading: isLoading,
    error: error?.message ?? null,
  }
}
