import { useQuery } from '@tanstack/react-query'
import { fetchPlays } from '../lib/queries'
import { queryKeys } from '../lib/queryKeys'

export function usePlays() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.plays.all,
    queryFn: fetchPlays,
  })

  return { plays: data ?? [], loading: isLoading }
}
