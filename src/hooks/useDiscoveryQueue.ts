import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface QueueItem {
  id: string
  raw_name: string
  raw_address: string | null
  raw_website_url: string | null
  raw_description: string | null
  enriched_venue_type: string | null
  enriched_calendar_url: string | null
  enriched_photo_url: string | null
  enriched_latitude: number | null
  enriched_longitude: number | null
  enriched_venue_type_confidence: number | null
  enrichment_status: string
  created_at: string
}

interface UseDiscoveryQueueResult {
  items: QueueItem[]
  loading: boolean
  dismiss: (id: string, note?: string) => Promise<void>
  refetch: () => void
}

export function useDiscoveryQueue(): UseDiscoveryQueueResult {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('venue_discovery_queue')
      .select('id, raw_name, raw_address, raw_website_url, raw_description, enriched_venue_type, enriched_calendar_url, enriched_photo_url, enriched_latitude, enriched_longitude, enriched_venue_type_confidence, enrichment_status, created_at')
      .eq('promoted', false)
      .eq('dedup_status', 'new')
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const dismiss = useCallback(async (id: string, note?: string) => {
    await supabase
      .from('venue_discovery_queue')
      .update({ dedup_status: 'skipped', admin_notes: note ?? null })
      .eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  return { items, loading, dismiss, refetch: load }
}
