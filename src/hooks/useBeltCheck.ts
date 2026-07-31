import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface BeltCheckResult {
  advanced: boolean
  newBeltLevel?: number
  beltName?: string
}

export function useBeltCheck() {
  const [result, setResult] = useState<BeltCheckResult | null>(null)
  const [checking, setChecking] = useState(false)

  const checkBelt = useCallback(async (): Promise<BeltCheckResult> => {
    setChecking(true)
    try {
      const { data, error } = await supabase.functions.invoke('belt-check', {
        method: 'POST',
      })
      if (error) throw error
      const res = data as BeltCheckResult
      if (res.advanced) setResult(res)
      return res
    } catch {
      return { advanced: false }
    } finally {
      setChecking(false)
    }
  }, [])

  const dismiss = useCallback(() => setResult(null), [])

  return { result, checking, checkBelt, dismiss }
}
