'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Shield, LayoutDashboard, FolderOpen, Settings, Users,
  ChevronLeft, ChevronRight, LogOut, BookOpen,
  TrendingUp, Database, Plus, Eye, Calendar,
  CheckSquare, Radio
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/types'

const navGroups = [
  {
    label: 'Main',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
      { href: '/cases', label: 'Cases', icon: FolderOpen, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
      { href: '/narratives', label: 'Narratives', icon: TrendingUp, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
      { href: '/reports', label: 'Reports', icon: BookOpen, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
    ]
  },
  {
    label: 'Investigation',
    items: [
      { href: '/evidence', label: 'Evidence Vault', icon: Database, roles: ['super_admin', 'admin', 'investigator'] },
      { href: '/accounts', label: 'Accounts', icon: Users, roles: ['super_admin', 'admin', 'investigator'] },
      { href: '/monitoring', label: 'Monitoring', icon: Radio, roles: ['super_admin', 'admin', 'investigator'] },
    ]
  },
  {
    label: 'Workspace',
    items: [
      { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: ['super_admin', 'admin', 'investigator'] },
      { href: '/calendar', label: 'Calendar', icon: Calendar, roles: ['super_admin', 'admin', 'investigator', 'viewer'] },
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/admin', label: 'Settings', icon: Settings, roles: ['super_admin', 'admin'] },
    ]
  },
]

interface SidebarProps {
  userRole: UserRole
  userName: string
  userEmail?: string
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300 shrink-0',
      collapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center border-b border-slate-800 h-14 px-4', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-none">CIT</p>
            <p className="text-slate-500 text-[10px] leading-none mt-0.5 truncate">Claim Intelligence</p>
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} className="ml-auto text-slate-600 hover:text-slate-400 p-0.5">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)} className="flex justify-center py-2 text-slate-600 hover:text-slate-400 border-b border-slate-800">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map(group => {
          const visibleItems = group.items.filter(item => item.roles.includes(userRole))
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-wider px-2 mb-1">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                  return (
                    <Link key={item.href} href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-600/15 text-blue-400'
                          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800',
                        collapsed && 'justify-center'
                      )}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Add button */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <Link href="/cases?add=1"
            className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Add & Evaluate Post
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-800 p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-300 text-xs font-medium truncate">{userName}</p>
              <p className="text-slate-600 text-[10px] capitalize truncate">{userRole.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className={cn(
            'flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-slate-800 w-full transition-colors',
            collapsed && 'justify-center'
          )}>
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  )
}
