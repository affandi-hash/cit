'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Radar, Search, RefreshCw, ChevronDown, ExternalLink,
  Filter, BarChart2, Tag, Globe, Zap, Eye, CheckCircle2,
  XCircle, Copy, BookmarkPlus, Camera, Scale, Loader2, Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadDetailModal } from './lead-detail-modal'
import type { Lead, LeadEntity, LeadBatch } from '@/types'
import { format } from 'date-fns'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new:              { label: 'New',              color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',    icon: <Zap className="w-3 h-3" /> },
  opened:           { label: 'Opened',           color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: <Eye className="w-3 h-3" /> },
  useful:           { label: 'Useful',           color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  not_relevant:     { label: 'Not Relevant',     color: 'bg-slate-600/20 text-slate-500 border-slate-600/30', icon: <XCircle className="w-3 h-3" /> },
  duplicate:        { label: 'Duplicate',        color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: <Copy className="w-3 h-3" /> },
  saved_to_case:    { label: 'Saved to Case',    color: 'bg-teal-500/20 text-teal-300 border-teal-500/30',   icon: <BookmarkPlus className="w-3 h-3" /> },
  needs_screenshot: { label: 'Needs Screenshot', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: <Camera className="w-3 h-3" /> },
  legal_review:     { label: 'Legal Review',     color: 'bg-red-500/20 text-red-300 border-red-500/30',      icon: <Scale className="w-3 h-3" /> },
}

const PRIORITY_CONFIG = {
  high:   { label: 'High',   dot: 'bg-red-500',    text: 'text-red-400' },
  medium: { label: 'Medium', dot: 'bg-yellow-500', text: 'text-yellow-400' },
  low:    { label: 'Low',    dot: 'bg-slate-500',  text: 'text-slate-400' },
}

interface Props {
  initialLeads: Lead[]
  entities: LeadEntity[]
  keywords: { keyword: string }[]
  batches: LeadBatch[]
}

export function LeadsClient({ initialLeads, entities, keywords }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [pulling, setPulling] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterEntity, setFilterEntity] = useState('all')

  // Stats
  const stats = useMemo(() => ({
    total:    leads.length,
    new:      leads.filter(l => l.status === 'new').length,
    useful:   leads.filter(l => l.status === 'useful').length,
    saved:    leads.filter(l => l.status === 'saved_to_case').length,
    duplicate:leads.filter(l => l.status === 'duplicate').length,
    high:     leads.filter(l => l.ai_priority === 'high').length,
  }), [leads])

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (filterPriority !== 'all' && l.ai_priority !== filterPriority) return false
      if (filterEntity !== 'all' && l.matched_entity !== filterEntity) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          l.author?.toLowerCase().includes(q) ||
          l.title?.toLowerCase().includes(q) ||
          l.snippet?.toLowerCase().includes(q) ||
          l.matched_keyword?.toLowerCase().includes(q) ||
          l.matched_entity?.toLowerCase().includes(q) ||
          l.lead_number?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [leads, filterStatus, filterPriority, filterEntity, search])

  async function pullLeads() {
    setPulling(true)
    try {
      const res = await fetch('/api/leads/search', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setLeads(prev => [...(data.leads as Lead[]), ...prev])
      toast.success(`${data.leads.length} new leads pulled`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPulling(false)
    }
  }

  function handleLeadUpdated(updated: Lead) {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
    setSelectedLead(updated)
  }

  function handleLeadConverted(leadId: string, caseNumber: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'saved_to_case' as const } : l))
    setSelectedLead(null)
    toast.success(`Saved as case ${caseNumber}`)
  }

  return (
    <div className="flex flex-col h-full bg-[#0A1628] min-h-screen">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(15,118,110,0.25)' }}>
            <Radar className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-base">Lead Discovery</h1>
            <p className="text-slate-500 text-xs">Deep search · surface · review · convert</p>
          </div>
        </div>
        <Button
          onClick={pullLeads}
          disabled={pulling}
          className="gap-2 text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)' }}
        >
          {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {pulling ? 'Pulling leads…' : 'Pull 20 Leads'}
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-6 gap-3 px-6 py-4 shrink-0">
        {[
          { label: 'Total',     value: stats.total,     color: 'text-white' },
          { label: 'New',       value: stats.new,       color: 'text-blue-400' },
          { label: 'Useful',    value: stats.useful,    color: 'text-emerald-400' },
          { label: 'Saved',     value: stats.saved,     color: 'text-teal-400' },
          { label: 'Duplicate', value: stats.duplicate, color: 'text-yellow-400' },
          { label: 'High Pri',  value: stats.high,      color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/40 border border-white/[0.06] rounded-xl px-4 py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 pb-4 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/40"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-slate-800/60 border border-white/[0.06] rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500/40 cursor-pointer"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>

        {/* Priority filter */}
        <div className="relative">
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-slate-800/60 border border-white/[0.06] rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500/40 cursor-pointer"
          >
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>

        {/* Entity filter */}
        <div className="relative">
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-slate-800/60 border border-white/[0.06] rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500/40 cursor-pointer"
          >
            <option value="all">All Entities</option>
            {entities.map(e => (
              <option key={e.id} value={e.name}>{e.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>

        <div className="flex items-center gap-1.5 text-slate-500 text-xs ml-auto">
          <Filter className="w-3.5 h-3.5" />
          <span>{filtered.length} leads</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600">
            <Radar className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">No leads yet</p>
            <p className="text-xs mt-1">Click &quot;Pull 20 Leads&quot; to start discovery</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Lead ID', 'Priority', 'Platform', 'Author / Source', 'Title / Snippet', 'Entity', 'Keyword', 'Narrative', 'Date Found', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(lead => {
                const sc = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new
                const pc = PRIORITY_CONFIG[lead.ai_priority] ?? PRIORITY_CONFIG.medium
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-mono text-teal-400 text-xs">{lead.lead_number}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${pc.dot}`} />
                        <span className={`text-xs font-medium ${pc.text}`}>{pc.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-300 text-xs">{lead.platform ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap max-w-[160px]">
                      <p className="text-white text-xs truncate">{lead.author ?? '—'}</p>
                    </td>
                    <td className="px-3 py-3 max-w-[260px]">
                      <p className="text-white text-xs font-medium truncate">{lead.title ?? '—'}</p>
                      <p className="text-slate-500 text-[11px] truncate mt-0.5">{lead.snippet ?? ''}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">{lead.matched_entity ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">{lead.matched_keyword ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3 max-w-[140px]">
                      <span className="text-xs text-slate-400 truncate block">{lead.narrative ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {format(new Date(lead.date_found), 'dd MMM yyyy')}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border ${sc.color}`}>
                        {sc.icon}
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {lead.url && (
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={handleLeadUpdated}
          onConverted={handleLeadConverted}
        />
      )}
    </div>
  )
}
