import { createClient } from '@/lib/supabase/server'
import { AccountsClient } from '@/components/accounts/accounts-client'

export default async function AccountsPage() {
  const supabase = await createClient()

  const [{ data: accounts }, { data: accountTypes }, { data: platforms }] = await Promise.all([
    supabase.from('accounts').select(`
      id, name, username, profile_url, followers, following, is_verified,
      workplace, company, phone_number, address, notes,
      name_status, username_status, workplace_status, company_status, phone_status, address_status,
      created_at, updated_at,
      account_types(id, name)
    `).order('created_at', { ascending: false }),
    supabase.from('account_types').select('id, name').eq('is_active', true).order('sort_order'),
    supabase.from('platforms').select('id, name').eq('is_active', true).order('sort_order'),
  ])

  return (
    <AccountsClient
      initialAccounts={(accounts ?? []) as unknown as Parameters<typeof AccountsClient>[0]['initialAccounts']}
      accountTypes={accountTypes ?? []}
      platforms={platforms ?? []}
    />
  )
}
