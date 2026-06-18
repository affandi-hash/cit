'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Shield, LayoutDashboard, FolderOpen, Settings, Users,
  ChevronLeft, ChevronRight, LogOut, BookOpen,
  TrendingUp, Database, Plus,
  Calendar, CheckSquare, Radio, Key, Bell, AlertCircle, Radar
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/types'

const NAV_ITEMS = [
  { href: '/',           label: 'Dashboard',     icon: LayoutDashboard, roles: ['super_admin','admin','investigator','viewer'] },
  { href: '/leads',      label: 'Lead Discovery', icon: Radar,           roles: ['super_admin','admin','investigator'] },
  { href: '/cases',      label: 'Cases',          icon: FolderOpen,      roles: ['super_admin','admin','investigator','viewer'] },
  { href: '/narratives', label: 'Narratives',     icon: TrendingUp,      roles: ['super_admin','admin','investigator','viewer'] },
  { href: '/admin',      label: 'Keywords',       icon: Key,             roles: ['super_admin','admin'] },
  { href: '/accounts',   label: 'Accounts',       icon: Users,           roles: ['super_admin','admin','investigator'] },
  { href: '/monitoring', label: 'Monitoring',     icon: Radio,           roles: ['super_admin','admin','investigator'] },
  { href: '/evidence',   label: 'Evidence Vault', icon: Database,        roles: ['super_admin','admin','investigator'] },
  { href: '/legal',      label: 'Legal Review',   icon: AlertCircle,     roles: ['super_admin','admin','investigator'], badge: '12', badgeRed: true },
  { href: '/reports',    label: 'Reports',        icon: BookOpen,        roles: ['super_admin','admin','investigator','viewer'] },
  { href: '/tasks',      label: 'Tasks',          icon: CheckSquare,     roles: ['super_admin','admin','investigator'], badge: '24' },
  { href: '/calendar',   label: 'Calendar',       icon: Calendar,        roles: ['super_admin','admin','investigator','viewer'] },
  { href: '/alerts',     label: 'Alerts',         icon: Bell,            roles: ['super_admin','admin','investigator'] },
]

interface SidebarProps {
  userRole: UserRole
  userName: string
  userEmail?: string
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

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen shrink-0 transition-all duration-300 overflow-hidden border-r border-white/[0.06]',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
      style={{ background: 'linear-gradient(180deg, #0D1B2A 0%, #081120 100%)' }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-white/[0.06] h-[64px] px-4 shrink-0',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)' }}
        >
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-[10px] leading-tight tracking-widest uppercase">Claim Intelligence</p>
            <p className="text-[9px] leading-tight mt-0.5 truncate" style={{ color: '#2DD4BF' }}>
              Evidence · Intelligence · Protection
            </p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-white/20 hover:text-white/60 transition-colors ml-1 shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="flex justify-center py-2 border-b border-white/[0.06] text-white/20 hover:text-white/60 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.filter(item => item.roles.includes(userRole)).map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 group relative',
                active ? 'text-teal-300' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]',
                collapsed && 'justify-center'
              )}
              style={active ? { background: 'rgba(15,118,110,0.18)' } : {}}
            >
              {active && !collapsed && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: '#0F766E' }}
                />
              )}
              <Icon className={cn(
                'w-4 h-4 shrink-0 transition-colors',
                active ? 'text-teal-400' : 'text-white/25 group-hover:text-white/55'
              )} />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badge && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none text-white"
                  style={{ background: item.badgeRed ? '#DC2626' : '#0F766E' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}

        <div className="my-3 mx-1 border-t border-white/[0.06]" />

        {/* Settings */}
        {['super_admin', 'admin'].includes(userRole) && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 group',
              isActive('/admin') ? 'text-teal-300' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]',
              collapsed && 'justify-center'
            )}
            style={isActive('/admin') ? { background: 'rgba(15,118,110,0.18)' } : {}}
          >
            <Settings className={cn('w-4 h-4 shrink-0', isActive('/admin') ? 'text-teal-400' : 'text-white/25 group-hover:text-white/55')} />
            {!collapsed && <span>Settings</span>}
          </Link>
        )}

        <Link
          href="/help"
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 group text-white/30 hover:text-white/60 hover:bg-white/[0.04]',
            collapsed && 'justify-center'
          )}
        >
          <span className={cn('w-4 h-4 shrink-0 text-center text-[11px] border border-white/20 rounded-full leading-none flex items-center justify-center group-hover:border-white/40')}>?</span>
          {!collapsed && <span>Help &amp; Support</span>}
        </Link>
      </nav>

      {/* Add & Evaluate Button */}
      <div className={cn('px-3 pb-3', collapsed && 'px-2')}>
        <Link
          href="/cases?add=1"
          className={cn(
            'flex items-center justify-center gap-2 w-full py-2.5 text-white text-[13px] font-semibold rounded-lg transition-all hover:brightness-110 active:scale-[0.98]',
          )}
          style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)' }}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && 'Add & Evaluate Post'}
        </Link>
      </div>

      {/* Footer / User */}
      <div className="border-t border-white/[0.06] p-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-1 py-1.5 mb-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white/80 text-xs font-medium truncate">{userName}</p>
              <p className="text-white/30 text-[10px] capitalize truncate">{userRole.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-white/30 hover:text-white/70 hover:bg-white/[0.04] w-full transition-all',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}
