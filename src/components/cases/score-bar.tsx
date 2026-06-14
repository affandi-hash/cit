import { cn } from '@/lib/utils'

interface ScoreBarProps {
  score: number | null | undefined
  size?: 'sm' | 'md'
}

export function ScoreBar({ score, size = 'sm' }: ScoreBarProps) {
  if (score == null) return <span className="text-slate-600 text-xs">—</span>

  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 75 ? 'bg-red-500' : pct >= 50 ? 'bg-yellow-500' : pct >= 25 ? 'bg-blue-500' : 'bg-slate-500'

  return (
    <div className="flex items-center gap-2">
      <div className={cn('bg-slate-700 rounded-full overflow-hidden', size === 'sm' ? 'w-16 h-1.5' : 'w-24 h-2')}>
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-400 text-xs tabular-nums">{pct.toFixed(0)}</span>
    </div>
  )
}
