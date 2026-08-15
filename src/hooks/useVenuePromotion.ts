import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { QueueItem, PromoteData } from '../lib/types'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function buildPromoteDefaults(item: QueueItem): PromoteData {
  return {
    name: item.raw_name,
    slug: generateSlug(item.raw_name),
    description: item.raw_description ?? '',
    venue_type: item.enriched_venue_type ?? 'storefront',
    address: item.raw_address ?? '',
    neighborhood: '',
    latitude: item.enriched_latitude,
    longitude: item.enriched_longitude,
    price_range: '',
    website_url: item.raw_website_url ?? '',
    calendar_url: item.enriched_calendar_url ?? '',
    genre_tags: [],
    accessibility_info: '',
    photo_url: item.enriched_photo_url ?? '',
  }
}

export function useVenuePromotion() {
  const promote = useCallback(async (queueId: string, data: PromoteData) => {
    let slug = data.slug

    // Check slug collision
    const { data: existing } = await supabase
      .from('venues')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      for (let i = 2; i <= 10; i++) {
        const candidate = `${slug}-${i}`
        const { data: check } = await supabase
          .from('venues')
          .select('id')
          .eq('slug', candidate)
          .maybeSingle()
        if (!check) { slug = candidate; break }
      }
    }

    const { data: venue, error } = await supabase
      .from('venues')
      .insert({
        name: data.name,
        slug,
        description: data.description || null,
        venue_type: data.venue_type,
        address: data.address || null,
        neighborhood: data.neighborhood || null,
        latitude: data.latitude,
        longitude: data.longitude,
        price_range: data.price_range || null,
        website_url: data.website_url || null,
        photo_url: data.photo_url || null,
        calendar_url: data.calendar_url || null,
        genre_tags: data.genre_tags,
        accessibility_info: data.accessibility_info || null,
        source: 'discovered',
      })
      .select('id')
      .single()

    if (error) throw error

    await supabase
      .from('venue_discovery_queue')
      .update({ promoted: true, promoted_venue_id: venue.id })
      .eq('id', queueId)

    return { venueId: venue.id }
  }, [])

  return { promote }
}
