import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface NewsItem {
  id: string
  kind: 'season_drop' | 'free' | 'closing_soon'
  kicker: string
  headline: string
  dek: string | null
  link_event_id: string | null
}

const KICKER_COLORS: Record<string, string> = {
  season_drop: 'oklch(0.80 0.14 55)',
  free: 'oklch(0.68 0.13 150)',
  closing_soon: 'oklch(0.58 0.16 300)',
}

export function SceneNews() {
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsItem[]>([])

  useEffect(() => {
    supabase
      .from('scene_news')
      .select('id, kind, kicker, headline, dek, link_event_id')
      .eq('active', true)
      .order('published_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setItems((data as NewsItem[]) ?? []))
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{ padding: '14px 20px 0' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'oklch(0.74 0.16 145)',
          }}
        />
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#625b4c',
          }}
        >
          THE SCENE RIGHT NOW
        </span>
      </div>

      {items.map((item, i) => (
        <div key={item.id}>
          {i > 0 && <div style={{ borderTop: '1px solid #211d17', margin: '12px 0' }} />}
          <button
            onClick={() => item.link_event_id && navigate(`/app/show/${item.link_event_id}`)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: item.link_event_id ? 'pointer' : 'default',
            }}
          >
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9.5,
                letterSpacing: '0.12em',
                color: KICKER_COLORS[item.kind] ?? '#625b4c',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {item.kicker}
            </div>
            <div
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 18,
                lineHeight: 1.2,
                color: 'var(--ink)',
                marginBottom: item.dek ? 4 : 0,
              }}
            >
              {item.headline}
            </div>
            {item.dek && (
              <div
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 14,
                  color: '#9c9586',
                }}
              >
                {item.dek}
              </div>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}
