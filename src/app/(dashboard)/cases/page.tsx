import { createClient } from '@/lib/supabase/server'
import { CasesClient } from '@/components/cases/cases-client'

export default async function CasesPage() {
  const supabase = await createClient()

  const [
    { data: cases },
    { data: platforms },
    { data: topics },
    { data: investigators },
  ] = await Promise.all([
    supabase.from('cases').select(`
      id, case_number, date_found, status, source_type, url,
      severity_color, influence_score, evidence_strength_score, overall_risk_score,
      ai_summary, created_at, updated_at,
      post_owner_name, post_datetime, emoji_count, post_comments, post_shares,
      platforms(id, name),
      topics(id, name),
      accounts(id, name, username)
    `).order('created_at', { ascending: false }),
    supabase.from('platforms').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('topics').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
  ])

  return (
    <CasesClient
      initialCases={(cases ?? []) as unknown as Parameters<typeof CasesClient>[0]['initialCases']}
      platforms={platforms ?? []}
      topics={topics ?? []}
      investigators={investigators ?? []}
    />
  )
}
