import { useRef, useCallback, type RefObject } from 'react'

const THRESHOLD = 60

export function usePullToRefresh(
  scrollRef: RefObject<HTMLDivElement | null>,
  onRefresh: () => Promise<void>,
) {
  const startY = useRef(0)
  const pulling = useRef(false)
  const refreshing = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing.current) return
    const el = scrollRef.current
    if (el && el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY
      pulling.current = true
    }
  }, [scrollRef])

  const onTouchEnd = useCallback(async (e: React.TouchEvent) => {
    if (!pulling.current || refreshing.current) return
    pulling.current = false
    const dy = e.changedTouches[0].clientY - startY.current
    if (dy >= THRESHOLD) {
      refreshing.current = true
      await onRefresh()
      refreshing.current = false
    }
  }, [onRefresh])

  return { onTouchStart, onTouchEnd }
}
