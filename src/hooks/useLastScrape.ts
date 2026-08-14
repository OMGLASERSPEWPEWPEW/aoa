import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useLastScrape() {
  const { data: lastScrapeTs } = useQuery({
    queryKey: ['last-scrape'],
    queryFn: async () => {
      const { data } = await supabase
        .from('scrape_logs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data?.created_at ?? null
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  return lastScrapeTs ?? null
}
