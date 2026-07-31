import { useEffect, useState } from 'react'
import { Activity, Eye, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface FeedItem {
  type: 'seen' | 'review'
  username: string
  eventTitle: string
  rating?: number
  date: string
}

interface Props {
  friendIds: string[]
}

export function ActivityFeed({ friendIds }: Props) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (friendIds.length === 0) { setLoading(false); return }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    Promise.all([
      supabase
        .from('watchlist')
        .select('user_id, status, updated_at, events(title), profiles:user_id(username)')
        .in('user_id', friendIds)
        .eq('status', 'seen')
        .gte('updated_at', sevenDaysAgo)
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase
        .from('reviews')
        .select('user_id, rating, created_at, events:event_id(title), profiles:user_id(username)')
        .in('user_id', friendIds)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(20),
    ]).then(([watchlistRes, reviewsRes]) => {
      const feed: FeedItem[] = []

      for (const w of watchlistRes.data ?? []) {
        const rec = w as Record<string, unknown>
        feed.push({
          type: 'seen',
          username: (rec.profiles as Record<string, unknown>)?.username as string ?? 'Someone',
          eventTitle: (rec.events as Record<string, unknown>)?.title as string ?? 'a show',
          date: w.updated_at,
        })
      }

      for (const r of reviewsRes.data ?? []) {
        const rec = r as Record<string, unknown>
        feed.push({
          type: 'review',
          username: (rec.profiles as Record<string, unknown>)?.username as string ?? 'Someone',
          eventTitle: (rec.events as Record<string, unknown>)?.title as string ?? 'a show',
          rating: r.rating as number,
          date: r.created_at as string,
        })
      }

      feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setItems(feed.slice(0, 20))
      setLoading(false)
    })
  }, [friendIds])

  if (loading) return null
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Activity size={14} className="text-amber-400" />
        <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Recent Activity</h3>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 bg-slate-800/30 rounded-lg p-2.5">
            {item.type === 'seen' ? (
              <Eye size={14} className="text-green-400 mt-0.5 shrink-0" />
            ) : (
              <Star size={14} className="text-amber-400 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-slate-300">
                <span className="text-white font-medium">{item.username}</span>
                {item.type === 'seen' ? ' saw ' : ' reviewed '}
                <span className="text-white">{item.eventTitle}</span>
                {item.rating && (
                  <span className="text-amber-400 ml-1">
                    {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                  </span>
                )}
              </p>
              <p className="text-slate-600 text-[10px] mt-0.5">
                {new Date(item.date).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
