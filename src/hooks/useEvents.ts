import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Event } from '../lib/types'

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('events')
      .select('*, venue:venues(*)')
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        setEvents((data as Event[]) ?? [])
        setLoading(false)
      })
  }, [])

  return { events, loading }
}
