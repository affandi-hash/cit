'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Shield, LayoutDashboard, FolderOpen, Settings, Users,
  ChevronLeft, ChevronRight, LogOut, Bell, BookOpen,
  TrendingUp, Database
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/types'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
  { href: '/cases', label: 'Cases', icon: FolderOpen, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
  { href: '/narratives', label: 'Narratives', icon: TrendingUp, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
  { href: '/evidence', label: 'Evidence Vault', icon: Database, roles: ['super_admin', 'admin', 'investigator'] },
  { href: '/reports', label: 'Reports', icon: BookOpen, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
  { href: '/admin', label: 'Admin Settings', icon: Settings, roles: ['super_admin', 'admin'] },
  { href: '/admin/users', label: 'Users', icon: Users, roles: ['super_admin', 'admin'] },
]

interface SidebarProps {
  userRole: UserRole
  userName: string
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems = navItems.filter(item => item.roles.includes(userRole))

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">CIT</p>
              <p className="text-slate-500 text-[10px] leading-none mt-0.5">Intelligence Tracker</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center mx-auto">
            <Shield className="w-4 h-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} className="text-slate-500 hover:text-white p-1 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)} className="flex items-center justify-center py-2 text-slate-500 hover:text-white border-b border-slate-800">
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800',
                collapsed && 'justify-center'
              )}>
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-3 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
              <span className="text-slate-300 text-xs font-medium">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-slate-300 text-xs font-medium truncate">{userName}</p>
              <p className="text-slate-500 text-[10px] capitalize">{userRole.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 w-full transition-colors',
            collapsed && 'justify-center'
          )}>
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  )
}
