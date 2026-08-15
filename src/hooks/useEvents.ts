import { useQuery } from '@tanstack/react-query'
import { fetchEventsWithJoins } from '../lib/queries'
import { queryKeys } from '../lib/queryKeys'

export function useEvents() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.events.all,
    queryFn: fetchEventsWithJoins,
  })

  return { events: data ?? [], loading: isLoading }
}
