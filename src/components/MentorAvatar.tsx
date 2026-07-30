export function MentorAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="text-slate-900 font-bold" style={{ fontSize: size * 0.45 }}>
        M
      </span>
    </div>
  )
}
