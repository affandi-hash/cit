'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCard {
  label: string
  value: number
  trend?: number
  color: string
  bg: string
  border: string
  dot?: string
}

const cards: StatCard[] = [
  { label: 'Total Cases', value: 0, color: 'text-white', bg: 'bg-slate-800/60', border: 'border-slate-700' },
  { label: 'Red Cases', value: 0, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/20', dot: 'bg-red-500' },
  { label: 'Yellow Cases', value: 0, color: 'text-yellow-400', bg: 'bg-yellow-500/5', border: 'border-yellow-500/20', dot: 'bg-yellow-500' },
  { label: 'Blue Cases', value: 0, color: 'text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  { label: 'Grey Cases', value: 0, color: 'text-slate-400', bg: 'bg-slate-700/30', border: 'border-slate-600/40', dot: 'bg-slate-500' },
  { label: 'Avg Risk Score', value: 0, color: 'text-orange-400', bg: 'bg-orange-500/5', border: 'border-orange-500/20' },
]

const keyMap = ['total_cases', 'red_cases', 'yellow_cases', 'blue_cases', 'grey_cases', 'avg_risk_score'] as const

interface StatsCardsProps {
  stats: {
    total_cases: number
    red_cases: number
    yellow_cases: number
    blue_cases: number
    grey_cases: number
    total_platforms: number
    total_topics: number
    total_influencers: number
    total_fake_accounts: number
    total_posts: number
    total_comments: number
    avg_risk_score?: number
  }
  trends?: Partial<Record<string, number>>
}

export function StatsCards({ stats, trends = {} }: StatsCardsProps) {
  const values: Record<string, number> = {
    total_cases: stats.total_cases,
    red_cases: stats.red_cases,
    yellow_cases: stats.yellow_cases,
    blue_cases: stats.blue_cases,
    grey_cases: stats.grey_cases,
    avg_risk_score: stats.avg_risk_score ?? 0,
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, i) => {
        const key = keyMap[i]
        const value = values[key] ?? 0
        const trend = trends[key]
        const isScore = key === 'avg_risk_score'

        return (
          <div key={key} className={cn('rounded-xl border p-4 flex flex-col gap-3', card.bg, card.border)}>
            <div className="flex items-center justify-between">
              {card.dot && <span className={cn('w-2 h-2 rounded-full', card.dot)} />}
              {trend !== undefined && (
                <TrendIndicator value={trend} />
              )}
            </div>
            <div>
              <p className={cn('text-2xl font-bold tabular-nums', card.color)}>
                {isScore ? value.toFixed(1) : value.toLocaleString()}
                {isScore && <span className="text-sm font-normal text-slate-600">/100</span>}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">{card.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TrendIndicator({ value }: { value: number }) {
  if (value === 0) return <Minus className="w-3 h-3 text-slate-600" />
  if (value > 0) return (
    <div className="flex items-center gap-0.5 text-emerald-400">
      <TrendingUp className="w-3 h-3" />
      <span className="text-[10px] font-medium">+{value.toFixed(1)}%</span>
    </div>
  )
  return (
    <div className="flex items-center gap-0.5 text-red-400">
      <TrendingDown className="w-3 h-3" />
      <span className="text-[10px] font-medium">{value.toFixed(1)}%</span>
    </div>
  )
}
