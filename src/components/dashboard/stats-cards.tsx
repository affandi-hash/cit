'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatDef {
  label: string
  key: 'total_cases' | 'red_cases' | 'yellow_cases' | 'blue_cases' | 'grey_cases' | 'avg_risk_score'
  dotColor?: string
  valueColor: string
  borderColor: string
  bgColor: string
  isScore?: boolean
}

const CARDS: StatDef[] = [
  { label: 'Total Cases',    key: 'total_cases',    valueColor: '#F1F5F9', borderColor: 'rgba(255,255,255,0.08)', bgColor: 'rgba(255,255,255,0.03)' },
  { label: 'Critical/Red',  key: 'red_cases',       valueColor: '#DC2626', borderColor: 'rgba(220,38,38,0.25)',   bgColor: 'rgba(220,38,38,0.06)',   dotColor: '#DC2626' },
  { label: 'Monitor/Yellow',key: 'yellow_cases',    valueColor: '#CA8A04', borderColor: 'rgba(202,138,4,0.25)',   bgColor: 'rgba(202,138,4,0.06)',   dotColor: '#CA8A04' },
  { label: 'Low/Blue',      key: 'blue_cases',      valueColor: '#2563EB', borderColor: 'rgba(37,99,235,0.25)',   bgColor: 'rgba(37,99,235,0.06)',   dotColor: '#2563EB' },
  { label: 'Neutral/Grey',  key: 'grey_cases',      valueColor: '#687280', borderColor: 'rgba(104,114,128,0.25)', bgColor: 'rgba(104,114,128,0.06)', dotColor: '#687280' },
  { label: 'Avg Risk Score', key: 'avg_risk_score', valueColor: '#EA580C', borderColor: 'rgba(234,88,12,0.25)',   bgColor: 'rgba(234,88,12,0.06)',   isScore: true },
]

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
  const values = {
    total_cases: stats.total_cases,
    red_cases: stats.red_cases,
    yellow_cases: stats.yellow_cases,
    blue_cases: stats.blue_cases,
    grey_cases: stats.grey_cases,
    avg_risk_score: stats.avg_risk_score ?? 0,
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARDS.map(card => {
        const value = values[card.key] ?? 0
        const trend = trends[card.key]

        return (
          <div key={card.key}
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: card.bgColor, border: `1px solid ${card.borderColor}` }}
          >
            <div className="flex items-center justify-between min-h-[16px]">
              {card.dotColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: card.dotColor }} />}
              {trend !== undefined && <TrendIndicator value={trend} />}
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: card.valueColor, fontFamily: 'var(--font-ibm-plex-sans)' }}>
                {card.isScore ? value.toFixed(1) : value.toLocaleString()}
                {card.isScore && <span className="text-sm font-normal" style={{ color: '#475569' }}>/100</span>}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{card.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TrendIndicator({ value }: { value: number }) {
  if (value === 0) return <Minus className="w-3 h-3" style={{ color: '#475569' }} />
  if (value > 0) return (
    <div className="flex items-center gap-0.5" style={{ color: '#10B981' }}>
      <TrendingUp className="w-3 h-3" />
      <span className="text-[10px] font-medium">+{value.toFixed(1)}%</span>
    </div>
  )
  return (
    <div className="flex items-center gap-0.5" style={{ color: '#DC2626' }}>
      <TrendingDown className="w-3 h-3" />
      <span className="text-[10px] font-medium">{value.toFixed(1)}%</span>
    </div>
  )
}
