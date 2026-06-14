'use client'

import { FolderOpen, MessageSquare, AlertTriangle, Globe, Tag, Users, Ghost } from 'lucide-react'

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
  }
}

const cards = [
  { key: 'total_cases', label: 'Total Cases', icon: FolderOpen, color: 'text-slate-300', bg: 'bg-slate-700/40', border: 'border-slate-700' },
  { key: 'total_posts', label: 'Total Posts', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { key: 'red_cases', label: 'RED Cases', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { key: 'yellow_cases', label: 'YELLOW Cases', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { key: 'blue_cases', label: 'BLUE Cases', icon: AlertTriangle, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { key: 'grey_cases', label: 'GREY Cases', icon: AlertTriangle, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { key: 'total_platforms', label: 'Platforms', icon: Globe, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { key: 'total_topics', label: 'Topics', icon: Tag, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { key: 'total_influencers', label: 'Influencers', icon: Users, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  { key: 'total_fake_accounts', label: 'Fake Accounts', icon: Ghost, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  { key: 'total_comments', label: 'Comments', icon: MessageSquare, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
]

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {cards.map(card => {
        const Icon = card.icon
        const value = stats[card.key as keyof typeof stats] ?? 0
        return (
          <div key={card.key}
            className={`rounded-xl border ${card.border} ${card.bg} p-4 flex flex-col gap-2`}>
            <div className={`${card.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${card.color}`}>{value.toLocaleString()}</p>
              <p className="text-slate-500 text-xs mt-0.5">{card.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
