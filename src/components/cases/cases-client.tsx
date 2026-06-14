'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SeverityBadge } from './severity-badge'
import { ScoreBar } from './score-bar'
import { CaseDetailModal } from './case-detail-modal'
import { AddPostModal } from './add-post-modal'
import {
  Search, Filter, Plus, Download, ChevronUp, ChevronDown,
  ExternalLink, MoreHorizontal
} from 'lucide-react'
import { format } from 'date-fns'
import type { Platform, Topic, SeverityColor, CaseStatus } from '@/types'

interface CaseRow {
  id: string
  case_number: string
  date_found: string
  status: CaseStatus
  source_type: string
  url: string | null
  severity_color: SeverityColor | null
  influence_score: number | null
  evidence_strength_score: number | null
  overall_risk_score: number | null
  ai_summary: string | null
  created_at: string
  updated_at: string
  platforms: { id: string; name: string } | null
  topics: { id: string; name: string } | null
  accounts: { id: string; name: string | null; username: string | null } | null
  profiles: { id: string; full_name: string | null; email: string } | { id: string; full_name: string | null; email: string }[] | null
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  under_review: 'bg-amber-500/20 text-amber-400',
  verified: 'bg-green-500/20 text-green-400',
  dismissed: 'bg-slate-600/40 text-slate-500',
  escalated: 'bg-red-500/20 text-red-400',
  closed: 'bg-slate-700/40 text-slate-600',
}

interface Props {
  initialCases: CaseRow[]
  platforms: Platform[]
  topics: Topic[]
  investigators: { id: string; full_name: string | null; email: string }[]
}

type SortKey = 'case_number' | 'date_found' | 'overall_risk_score' | 'updated_at'
type SortDir = 'asc' | 'desc'

export function CasesClient({ initialCases, platforms, topics, investigators }: Props) {
  const router = useRouter()
  const [cases] = useState(initialCases)
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterTopic, setFilterTopic] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at' as SortKey)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let result = [...cases]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.case_number.toLowerCase().includes(q) ||
        c.ai_summary?.toLowerCase().includes(q) ||
        c.accounts?.name?.toLowerCase().includes(q) ||
        c.accounts?.username?.toLowerCase().includes(q) ||
        c.url?.toLowerCase().includes(q)
      )
    }
    if (filterPlatform !== 'all') result = result.filter(c => c.platforms?.id === filterPlatform)
    if (filterTopic !== 'all') result = result.filter(c => c.topics?.id === filterTopic)
    if (filterSeverity !== 'all') result = result.filter(c => c.severity_color === filterSeverity)
    if (filterStatus !== 'all') result = result.filter(c => c.status === filterStatus)

    result.sort((a, b) => {
      const av = a[sortKey as keyof CaseRow] ?? ''
      const bv = b[sortKey as keyof CaseRow] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [cases, search, filterPlatform, filterTopic, filterSeverity, filterStatus, sortKey, sortDir])

  function exportCSV() {
    const headers = ['Case ID', 'Date Found', 'Platform', 'Topic', 'Account', 'Severity', 'Risk Score', 'Status', 'Summary']
    const rows = filtered.map(c => [
      c.case_number, c.date_found, c.platforms?.name ?? '',
      c.topics?.name ?? '', c.accounts?.name ?? '',
      c.severity_color ?? '', c.overall_risk_score ?? '',
      c.status, c.ai_summary?.replace(/,/g, ';') ?? '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `cit-cases-${Date.now()}.csv`; a.click()
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cases</h1>
          <p className="text-slate-500 text-sm mt-0.5">{filtered.length} of {cases.length} cases</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}
            className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => setAddModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Post
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search cases..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        <Select value={filterPlatform} onValueChange={v => setFilterPlatform(v ?? 'all')}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-300">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Platforms</SelectItem>
            {platforms.map(p => <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterTopic} onValueChange={v => setFilterTopic(v ?? 'all')}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-300">
            <SelectValue placeholder="Topic" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Topics</SelectItem>
            {topics.map(t => <SelectItem key={t.id} value={t.id} className="text-white">{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterSeverity} onValueChange={v => setFilterSeverity(v ?? 'all')}>
          <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-slate-300">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Severity</SelectItem>
            {['RED', 'YELLOW', 'BLUE', 'GREY'].map(s => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? 'all')}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-300">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Status</SelectItem>
            {['new', 'under_review', 'verified', 'dismissed', 'escalated', 'closed'].map(s => (
              <SelectItem key={s} value={s} className="text-white capitalize">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80">
                {[
                  { label: 'Case ID', key: 'case_number' as SortKey },
                  { label: 'Date Found', key: 'date_found' as SortKey },
                  { label: 'Platform' },
                  { label: 'Account' },
                  { label: 'Topic' },
                  { label: 'Summary' },
                  { label: 'Severity' },
                  { label: 'Risk Score', key: 'overall_risk_score' as SortKey },
                  { label: 'Status' },
                  { label: 'Investigator' },
                  { label: '' },
                ].map((col, i) => (
                  <th key={i}
                    className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-white' : ''}`}
                    onClick={() => col.key && toggleSort(col.key)}>
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.key && <SortIcon k={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-600">
                    No cases found. Add your first post to get started.
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedCase(c)}>
                    <td className="px-4 py-3 font-mono text-red-400 text-xs whitespace-nowrap">{c.case_number}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {format(new Date(c.date_found), 'dd MMM yy')}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{c.platforms?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      <div>{c.accounts?.name ?? '—'}</div>
                      {c.accounts?.username && <div className="text-slate-500">@{c.accounts.username}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{c.topics?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs">
                      <p className="truncate">{c.ai_summary ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3"><SeverityBadge color={c.severity_color} /></td>
                    <td className="px-4 py-3"><ScoreBar score={c.overall_risk_score} /></td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? ''}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {(() => { const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles; return p?.full_name ?? p?.email ?? '—' })()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); setSelectedCase(c) }}
                        className="text-slate-600 hover:text-white p-1 rounded">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedCase && (
        <CaseDetailModal
          caseId={selectedCase.id}
          open={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          onUpdate={() => router.refresh()}
        />
      )}

      <AddPostModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        platforms={platforms}
        topics={topics}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
