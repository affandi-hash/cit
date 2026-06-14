import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: cases },
    { data: platforms },
    { data: topics },
  ] = await Promise.all([
    supabase.from('cases').select(`
      id, case_number, severity_color, platform_id, topic_id, date_found,
      overall_risk_score, status, source_type, influence_score, evidence_strength_score,
      ai_summary,
      platforms(name),
      topics(name),
      accounts(name, username)
    `).order('created_at', { ascending: false }).limit(200),
    supabase.from('platforms').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('topics').select('*').eq('is_active', true).order('sort_order'),
  ])

  const caseList = (cases ?? []) as unknown as {
    id: string; case_number: string; severity_color: string | null
    platform_id: string | null; topic_id: string | null; date_found: string
    overall_risk_score: number | null; status: string; source_type: string
    influence_score: number | null; evidence_strength_score: number | null
    ai_summary: string | null
    platforms: { name: string } | null
    topics: { name: string } | null
    accounts: { name: string | null; username: string | null } | null
  }[]

  const platformList = platforms ?? []
  const topicList = topics ?? []

  const riskScores = caseList.map(c => c.overall_risk_score).filter((s): s is number => s !== null)
  const avgRisk = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0

  const stats = {
    total_cases: caseList.length,
    total_posts: caseList.length,
    total_comments: 0,
    red_cases: caseList.filter(c => c.severity_color === 'RED').length,
    yellow_cases: caseList.filter(c => c.severity_color === 'YELLOW').length,
    blue_cases: caseList.filter(c => c.severity_color === 'BLUE').length,
    grey_cases: caseList.filter(c => c.severity_color === 'GREY').length,
    total_platforms: new Set(caseList.map(c => c.platform_id).filter(Boolean)).size,
    total_topics: new Set(caseList.map(c => c.topic_id).filter(Boolean)).size,
    total_influencers: caseList.filter(c => c.influence_score !== null && c.influence_score >= 60).length,
    total_fake_accounts: 0,
    avg_risk_score: Math.round(avgRisk * 10) / 10,
  }

  // Claims by platform
  const platformCounts: Record<string, number> = {}
  caseList.forEach(c => {
    const name = c.platforms?.name
    if (name) platformCounts[name] = (platformCounts[name] ?? 0) + 1
  })
  const claimsByPlatform = Object.entries(platformCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Claims by topic
  const topicCounts: Record<string, number> = {}
  caseList.forEach(c => {
    const name = c.topics?.name
    if (name) topicCounts[name] = (topicCounts[name] ?? 0) + 1
  })
  const claimsByTopic = Object.entries(topicCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

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

  // Recent cases for table
  const recentCases = caseList.slice(0, 10).map(c => ({
    id: c.id,
    case_number: c.case_number,
    platform: c.platforms?.name ?? '—',
    source_type: c.source_type,
    account: c.accounts?.name ?? c.accounts?.username ?? '—',
    topic: c.topics?.name ?? '—',
    summary: c.ai_summary ?? '',
    severity_color: c.severity_color ?? 'GREY',
    influence_score: c.influence_score,
    evidence_score: c.evidence_strength_score,
    risk_score: c.overall_risk_score,
    status: c.status,
    investigator: '',
    date: c.date_found,
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
      recentCases={recentCases}
    />
  )
}
