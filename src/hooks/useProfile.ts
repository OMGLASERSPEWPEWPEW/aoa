import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { fetchProfile, fetchUserProgress } from '../lib/queries'

export function useProfile() {
  const { user } = useAuth()

  const profileQuery = useQuery({
    queryKey: queryKeys.profile.detail(user?.id ?? ''),
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  })

  const progressQuery = useQuery({
    queryKey: queryKeys.profile.progress(user?.id ?? ''),
    queryFn: () => fetchUserProgress(user!.id),
    enabled: !!user,
  })

  const refetch = () => {
    profileQuery.refetch()
    progressQuery.refetch()
  }

  return {
    profile: profileQuery.data ?? null,
    progress: progressQuery.data ?? null,
    loading: profileQuery.isLoading || progressQuery.isLoading,
    error: profileQuery.error?.message ?? progressQuery.error?.message ?? null,
    refetch,
  }
}
