'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StatsCards } from './stats-cards'
import {
  ClaimsByPlatformChart, ClaimsByTopicChart,
  ClaimsBySeverityChart, ClaimsByDateChart
} from './charts'
import { AddPostModal } from '@/components/cases/add-post-modal'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'
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
  }
  claimsByPlatform: { name: string; value: number }[]
  claimsByTopic: { name: string; count: number }[]
  claimsBySeverity: { name: string; count: number; color: string }[]
  claimsByDate: { date: string; count: number }[]
  platforms: Platform[]
  topics: Topic[]
}

export function DashboardClient({
  stats, claimsByPlatform, claimsByTopic, claimsBySeverity, claimsByDate, platforms, topics
}: Props) {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const router = useRouter()

  const handleSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Intelligence Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time overview of all tracked claims and investigations</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => setAddModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add & Evaluate Post
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Charts — row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClaimsByPlatformChart data={claimsByPlatform} />
        <ClaimsBySeverityChart data={claimsBySeverity} />
      </div>

      {/* Charts — row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClaimsByTopicChart data={claimsByTopic} />
        <ClaimsByDateChart data={claimsByDate} />
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
