import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Play } from '../lib/types'

async function fetchPlays(): Promise<Play[]> {
  const { data } = await supabase
    .from('plays')
    .select('*')
    .order('title', { ascending: true })
  return (data as Play[]) ?? []
}

export function usePlays() {
  const { data, isLoading } = useQuery({
    queryKey: ['plays'],
    queryFn: fetchPlays,
  })

  return { plays: data ?? [], loading: isLoading }
}
