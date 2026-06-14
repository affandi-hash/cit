import { cn } from '@/lib/utils'
import type { SeverityColor } from '@/types'

const config = {
  RED: 'bg-red-500/20 text-red-400 border-red-500/40',
  YELLOW: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  BLUE: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  GREY: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
}

export function SeverityBadge({ color }: { color: SeverityColor | null | undefined }) {
  if (!color) return <span className="text-slate-600 text-xs">—</span>
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border', config[color])}>
      {color}
    </span>
  )
}
