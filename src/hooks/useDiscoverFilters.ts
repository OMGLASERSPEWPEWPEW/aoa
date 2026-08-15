import { useState, useEffect } from 'react'
import { EMOTIONS } from '../lib/emotions'
import type { Emotion } from '../lib/emotions'
import { fetchEventSpectrumByEmotion } from '../lib/queries'

const EMOTION_SLUGS = new Set(EMOTIONS.map(e => e.slug as string))

export function useDiscoverFilters() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [venueTypeFilter, setVenueTypeFilter] = useState('all')
  const [emotionMatchIds, setEmotionMatchIds] = useState<Set<string>>(new Set())
  const [matchedEmotion, setMatchedEmotion] = useState<Emotion | null>(null)

  useEffect(() => {
    if (!search) {
      setEmotionMatchIds(new Set())
      setMatchedEmotion(null)
      return
    }
    const tokens = search.toLowerCase().split(/\s+/)
    const emotionToken = tokens.find(t => EMOTION_SLUGS.has(t))
    if (!emotionToken) {
      setEmotionMatchIds(new Set())
      setMatchedEmotion(null)
      return
    }
    setMatchedEmotion(emotionToken as Emotion)
    fetchEventSpectrumByEmotion(emotionToken, 25).then(rows => {
      setEmotionMatchIds(new Set(rows.map(r => r.event_id)))
    })
  }, [search])

  /** Filter out emotion tokens from search to get text-only tokens */
  function getTextTokens(): string[] {
    if (!search) return []
    return search.toLowerCase().split(/\s+/).filter(t => !EMOTION_SLUGS.has(t))
  }

  return {
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    venueTypeFilter,
    setVenueTypeFilter,
    emotionMatchIds,
    matchedEmotion,
    getTextTokens,
    EMOTION_SLUGS,
  }
}
