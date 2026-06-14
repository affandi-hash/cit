import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminClient } from '@/components/admin/admin-client'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) redirect('/')

  const [
    { data: platforms },
    { data: topics },
    { data: severityLevels },
    { data: accountTypes },
    { data: scoringFormulas },
    { data: aiPrompts },
    { data: users },
    { data: keywordGroups },
    { data: keywords },
  ] = await Promise.all([
    supabase.from('platforms').select('*').order('sort_order'),
    supabase.from('topics').select('*').order('sort_order'),
    supabase.from('severity_levels').select('*').order('sort_order'),
    supabase.from('account_types').select('*').order('sort_order'),
    supabase.from('scoring_formulas').select('*'),
    supabase.from('ai_prompts').select('*'),
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('keyword_groups').select('*').order('sort_order'),
    supabase.from('keywords').select('*').order('keyword'),
  ])

  return (
    <AdminClient
      platforms={platforms ?? []}
      topics={topics ?? []}
      severityLevels={severityLevels ?? []}
      accountTypes={accountTypes ?? []}
      scoringFormulas={scoringFormulas ?? []}
      aiPrompts={aiPrompts ?? []}
      users={users ?? []}
      currentUserRole={profile.role as 'super_admin' | 'admin'}
      keywordGroups={keywordGroups ?? []}
      keywords={keywords ?? []}
    />
  )
}
