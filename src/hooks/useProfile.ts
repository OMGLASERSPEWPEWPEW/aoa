import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { log, warn } from '../lib/diagnostics'
import type { Profile, UserProgress } from '../lib/types'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      const [profileRes, progressRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('user_progress').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      if (profileRes.error) {
        warn('query', 'profiles query failed', { error: profileRes.error.message, code: profileRes.error.code })
        setError(profileRes.error.message)
      } else {
        setProfile(profileRes.data as Profile | null)
        log('query', 'profile loaded', { hasProfile: !!profileRes.data })
      }
      if (progressRes.error) {
        warn('query', 'progress query failed', { error: progressRes.error.message })
      } else {
        setProgress(progressRes.data as UserProgress | null)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warn('query', 'useProfile unexpected error', { error: msg })
      setError(msg)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  return { profile, progress, loading, error, refetch: fetchData }
}
