import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Event } from '../lib/types'

async function fetchEvents(): Promise<Event[]> {
  const { data } = await supabase
    .from('events')
    .select('*, venue:venues(*), play:plays(*)')
    .order('start_date', { ascending: true })
  return (data as Event[]) ?? []
}

export function useEvents() {
  const { data, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  })

  return { events: data ?? [], loading: isLoading }
}
