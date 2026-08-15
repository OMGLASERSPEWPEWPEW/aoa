import { useQuery } from '@tanstack/react-query'
import { fetchLastScrape } from '../lib/queries'
import { queryKeys } from '../lib/queryKeys'

export function useLastScrape() {
  const { data: lastScrapeTs } = useQuery({
    queryKey: queryKeys.scrape.last,
    queryFn: fetchLastScrape,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  return lastScrapeTs ?? null
}
