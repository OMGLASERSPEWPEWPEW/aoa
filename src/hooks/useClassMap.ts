import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { fetchClassMapData } from '../lib/classData'
import { queryKeys } from '../lib/queryKeys'

export function useClassMap() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.classMap.all(userId),
    queryFn: () => fetchClassMapData(userId),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })

  return {
    schools: data?.schools ?? [],
    userInterests: data?.userInterests ?? [],
    isLoading,
  }
}
