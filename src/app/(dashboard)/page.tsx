import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: cases },
    { data: platforms },
    { data: topics },
    { data: accounts },
  ] = await Promise.all([
    supabase.from('cases').select('id, severity_color, platform_id, topic_id, date_found, overall_risk_score, status'),
    supabase.from('platforms').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('topics').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('accounts').select('id, account_type_id, account_types(name)'),
  ])

  const caseList = cases ?? []
  const platformList = platforms ?? []
  const topicList = topics ?? []
  const accountList = accounts ?? []

  // Stats
  const stats = {
    total_cases: caseList.length,
    total_posts: caseList.filter(c => c.status !== 'dismissed').length,
    total_comments: 0,
    red_cases: caseList.filter(c => c.severity_color === 'RED').length,
    yellow_cases: caseList.filter(c => c.severity_color === 'YELLOW').length,
    blue_cases: caseList.filter(c => c.severity_color === 'BLUE').length,
    grey_cases: caseList.filter(c => c.severity_color === 'GREY').length,
    total_platforms: new Set(caseList.map(c => c.platform_id).filter(Boolean)).size,
    total_topics: new Set(caseList.map(c => c.topic_id).filter(Boolean)).size,
    total_influencers: 0,
    total_fake_accounts: 0,
  }

  // Claims by platform
  const platformCounts: Record<string, number> = {}
  caseList.forEach(c => {
    if (c.platform_id) {
      const p = platformList.find(pl => pl.id === c.platform_id)
      if (p) platformCounts[p.name] = (platformCounts[p.name] ?? 0) + 1
    }
  })
  const claimsByPlatform = Object.entries(platformCounts).map(([name, value]) => ({ name, value }))

  // Claims by topic
  const topicCounts: Record<string, number> = {}
  caseList.forEach(c => {
    if (c.topic_id) {
      const t = topicList.find(tp => tp.id === c.topic_id)
      if (t) topicCounts[t.name] = (topicCounts[t.name] ?? 0) + 1
    }
  })
  const claimsByTopic = Object.entries(topicCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Claims by severity
  const claimsBySeverity = [
    { name: 'RED', count: stats.red_cases, color: 'RED' },
    { name: 'YELLOW', count: stats.yellow_cases, color: 'YELLOW' },
    { name: 'BLUE', count: stats.blue_cases, color: 'BLUE' },
    { name: 'GREY', count: stats.grey_cases, color: 'GREY' },
  ]

  // Claims by date (last 30 days)
  const last30 = new Map<string, number>()
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    last30.set(d.toISOString().split('T')[0], 0)
  }
  caseList.forEach(c => {
    if (c.date_found && last30.has(c.date_found)) {
      last30.set(c.date_found, (last30.get(c.date_found) ?? 0) + 1)
    }
  })
  const claimsByDate = Array.from(last30.entries()).map(([date, count]) => ({
    date: date.substring(5),
    count,
  }))

  return (
    <DashboardClient
      stats={stats}
      claimsByPlatform={claimsByPlatform}
      claimsByTopic={claimsByTopic}
      claimsBySeverity={claimsBySeverity}
      claimsByDate={claimsByDate}
      platforms={platformList}
      topics={topicList}
    />
  )
}
