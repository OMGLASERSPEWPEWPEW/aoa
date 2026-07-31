import { useEffect, useState } from 'react'
import { BELT_NAMES, BELT_COLORS } from '../lib/types'

const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']

interface Props {
  beltLevel: number
  onClose: () => void
}

export function BeltUpgradeModal({ beltLevel, onClose }: Props) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string; delay: number; size: number }[]>([])

  useEffect(() => {
    const p = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.5,
      size: 4 + Math.random() * 8,
    }))
    setParticles(p)
  }, [])

  const beltName = BELT_NAMES[beltLevel] ?? 'Unknown'
  const colorClass = BELT_COLORS[beltLevel] ?? 'bg-slate-700 text-white'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="relative bg-slate-900 rounded-2xl p-8 mx-4 max-w-sm w-full text-center overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-sm animate-confetti pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `-${p.size}px`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}

        <div className="relative z-10">
          <div className="text-4xl mb-4">🥋</div>
          <h2 className="text-2xl font-bold text-white mb-2">Belt Upgrade!</h2>
          <p className="text-slate-400 mb-6">You've earned a new belt</p>

          <div className={`inline-block px-6 py-3 rounded-xl text-lg font-bold ${colorClass} mb-6`}>
            {beltName} Belt
          </div>

          <p className="text-slate-500 text-sm mb-6">
            Keep exploring Chicago theater to earn your next belt!
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-amber-400 text-slate-900 font-medium hover:bg-amber-300 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti-fall 2.5s ease-in forwards;
        }
      `}</style>
    </div>
  )
}
