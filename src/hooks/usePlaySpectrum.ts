import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { fetchPlaySpectrum } from '../lib/queries'
import type { SpectrumSlice } from '../lib/types'

export interface UsePlaySpectrumResult {
  slices: SpectrumSlice[]
  totalCards: number
  loading: boolean
}

export function usePlaySpectrum(playId: string): UsePlaySpectrumResult {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.plays.spectrum(playId),
    queryFn: () => fetchPlaySpectrum(playId),
    enabled: !!playId,
  })

  return {
    slices: data?.slices ?? [],
    totalCards: data?.totalCards ?? 0,
    loading: isLoading,
  }
}
