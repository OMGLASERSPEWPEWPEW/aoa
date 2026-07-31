import { Star } from 'lucide-react'

interface Props {
  rating: number | null
  count: number
}

export function CommunityRating({ rating, count }: Props) {
  if (!rating || count === 0) return null

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => {
          const fill = Math.min(1, Math.max(0, rating - (n - 1)))
          return (
            <div key={n} className="relative">
              <Star size={16} className="text-slate-700" />
              {fill > 0 && (
                <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <span className="text-amber-400 text-sm font-medium">{rating.toFixed(1)}</span>
      <span className="text-slate-500 text-xs">({count} review{count !== 1 ? 's' : ''})</span>
    </div>
  )
}
