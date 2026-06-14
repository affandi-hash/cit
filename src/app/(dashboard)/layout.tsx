import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import type { UserRole } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'viewer') as UserRole
  const name = profile?.full_name ?? profile?.email ?? 'User'

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar userRole={role} userName={name} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
