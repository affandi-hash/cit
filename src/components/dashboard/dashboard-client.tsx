'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StatsCards } from './stats-cards'
import {
  ClaimsByPlatformChart, ClaimsByTopicChart,
  ClaimsBySeverityChart, ClaimsByDateChart,
  TopInfluencingPostsTable, NarrativeTrendTable,
} from './charts'
import { AddPostModal } from '@/components/cases/add-post-modal'
import { Button } from '@/components/ui/button'
import { Plus, Bell, Calendar, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import type { Platform, Topic } from '@/types'

interface Props {
  stats: {
    total_cases: number
    total_posts: number
    total_comments: number
    red_cases: number
    yellow_cases: number
    blue_cases: number
    grey_cases: number
    total_platforms: number
    total_topics: number
    total_influencers: number
    total_fake_accounts: number
    avg_risk_score?: number
  }
  claimsByPlatform: { name: string; value: number }[]
  claimsByTopic: { name: string; count: number }[]
  claimsBySeverity: { name: string; count: number; color: string }[]
  claimsByDate: { date: string; count: number }[]
  platforms: Platform[]
  topics: Topic[]
  recentCases?: {
    id: string
    case_number: string
    platform: string
    source_type: string
    account: string
    topic: string
    summary: string
    severity_color: string
    influence_score: number | null
    evidence_score: number | null
    risk_score: number | null
    status: string
    investigator: string
    date: string
  }[]
}

export function DashboardClient({
  stats, claimsByPlatform, claimsByTopic, claimsBySeverity, claimsByDate,
  platforms, topics, recentCases = [],
}: Props) {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const router = useRouter()
  const today = new Date()

  const handleSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  const dateLabel = `${format(new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()), 'dd MMM yyyy')} – ${format(today, 'dd MMM yyyy')}`

  return (
    <div className="flex flex-col h-full" style={{ background: '#0A1628' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div>
          <h2 className="font-semibold text-white" style={{ fontSize: 24 }}>Dashboard</h2>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Claim Intelligence Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}>
            <Calendar className="w-3.5 h-3.5" />
            {dateLabel}
          </div>
          <button onClick={() => router.refresh()} className="relative p-2 rounded-lg transition-colors" style={{ color: '#64748B' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="relative p-2 rounded-lg transition-colors" style={{ color: '#64748B' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Bell className="w-4 h-4" />
            {stats.red_cases > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: '#DC2626' }} />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Row 1: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <ClaimsByPlatformChart data={claimsByPlatform} />
          </div>
          <div className="lg:col-span-2">
            <ClaimsByTopicChart data={claimsByTopic} />
          </div>
        </div>

        {/* Row 2: Severity + Date */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ClaimsBySeverityChart data={claimsBySeverity} />
          <ClaimsByDateChart data={claimsByDate} />
        </div>

        {/* Row 3: Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopInfluencingPostsTable cases={recentCases.slice(0, 5)} />
          <NarrativeTrendTable topics={claimsByTopic.slice(0, 6)} />
        </div>

      </div>

      {/* Floating Add Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setAddModalOpen(true)}
          className="text-white font-semibold px-5 h-11 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)', boxShadow: '0 8px 24px rgba(15,118,110,0.35)' }}
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add & Evaluate Post
        </Button>
      </div>

      <AddPostModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        platforms={platforms}
        topics={topics}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
