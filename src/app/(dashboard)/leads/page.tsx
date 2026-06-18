import { createClient } from '@/lib/supabase/server'
import { LeadsClient } from '@/components/leads/leads-client'

export default async function LeadsPage() {
  const supabase = await createClient()

  const [
    { data: leads },
    { data: entities },
    { data: keywords },
    { data: batches },
  ] = await Promise.all([
    supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('lead_entities').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('lead_keywords').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('lead_batches').select('*').order('created_at', { ascending: false }).limit(10),
  ])

  return (
    <LeadsClient
      initialLeads={leads ?? []}
      entities={entities ?? []}
      keywords={keywords ?? []}
      batches={batches ?? []}
    />
  )
}
