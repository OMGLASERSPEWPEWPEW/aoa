import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, UserProgress } from '../lib/types'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user) return
    const [profileRes, progressRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_progress').select('*').eq('user_id', user.id).maybeSingle(),
    ])
    setProfile(profileRes.data as Profile | null)
    setProgress(progressRes.data as UserProgress | null)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  return { profile, progress, loading, refetch: fetchData }
}
