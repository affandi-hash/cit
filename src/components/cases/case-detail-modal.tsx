'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SeverityBadge } from './severity-badge'
import { ScoreBar } from './score-bar'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ExternalLink, Upload, Shield, FileText, Users, Activity,
  History, Loader2, User, Calendar, MessageCircle, Share2,
  Smile, LayoutGrid, AlertTriangle, CheckCircle2, Save
} from 'lucide-react'
import type { Case, PostVersion, Evidence, Engagement } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  caseId: string
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

const STATUS_OPTIONS = ['new', 'under_review', 'verified', 'dismissed', 'escalated', 'closed']

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  under_review: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  verified: 'bg-green-500/15 text-green-400 border-green-500/25',
  dismissed: 'bg-slate-600/20 text-slate-500 border-slate-600/30',
  escalated: 'bg-red-500/20 text-red-400 border-red-500/30',
  closed: 'bg-slate-700/30 text-slate-500 border-slate-700/40',
}

const PRIORITY_STRIPE: Record<string, string> = {
  DARK_RED: 'bg-red-700',
  RED: 'bg-red-500',
  ORANGE: 'bg-orange-500',
  YELLOW: 'bg-yellow-500',
  BLUE: 'bg-blue-500',
}

const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  DARK_RED: { label: 'Critical', cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  RED:      { label: 'High',     cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  ORANGE:   { label: 'Serious',  cls: 'text-orange-400 bg-orange-500/10 border-orange-500/25' },
  YELLOW:   { label: 'Monitor',  cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  BLUE:     { label: 'Low',      cls: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
}

export function CaseDetailModal({ caseId, open, onClose, onUpdate }: Props) {
  const supabase = createClient()
  const [caseData, setCaseData] = useState<Record<string, unknown> | null>(null)
  const [versions, setVersions] = useState<PostVersion[]>([])
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([])
  const [engagement, setEngagement] = useState<Engagement | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [caseScores, setCaseScores] = useState<Record<string, unknown> | null>(null)
  const [keywordMatches, setKeywordMatches] = useState<Record<string, unknown>[]>([])
  const [accForm, setAccForm] = useState<Record<string, string>>({})
  const [savingAcc, setSavingAcc] = useState(false)

  useEffect(() => {
    if (!open || !caseId) return
    loadCase()
  }, [open, caseId])

  async function loadCase() {
    setLoading(true)
    const [
      { data: c },
      { data: v },
      { data: e },
      { data: eng },
      { data: scores },
      { data: matches },
    ] = await Promise.all([
      supabase.from('cases').select(`
        *, platforms(name), topics(name), severity_levels(name, color, description),
        accounts(*, account_types(name)),
        profiles!assigned_investigator_id(full_name, email)
      `).eq('id', caseId).single(),
      supabase.from('post_versions').select('*, profiles!uploaded_by_id(full_name, email)').eq('case_id', caseId).order('version_number'),
      supabase.from('evidence').select('*, profiles!uploaded_by_id(full_name, email)').eq('case_id', caseId).order('created_at'),
      supabase.from('engagements').select('*').eq('case_id', caseId).order('capture_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('case_scores').select('*').eq('case_id', caseId).maybeSingle(),
      supabase.from('case_keyword_matches').select('*, keywords(keyword, keyword_type, color_tag, seriousness_score, reputation_score, is_legal_flag)').eq('case_id', caseId).order('frequency', { ascending: false }),
    ])
    setCaseData(c)
    setVersions((v ?? []) as unknown as PostVersion[])
    setEvidenceList((e ?? []) as unknown as Evidence[])
    setEngagement(eng as Engagement | null)
    setCaseScores(scores as Record<string, unknown> | null)
    setKeywordMatches((matches ?? []) as Record<string, unknown>[])
    if (c?.accounts) {
      const a = c.accounts as Record<string, unknown>
      setAccForm({
        name: (a.name as string) ?? '',
        username: (a.username as string) ?? '',
        ic_number: (a.ic_number as string) ?? '',
        email_address: (a.email_address as string) ?? '',
        phone_number: (a.phone_number as string) ?? '',
        phone_number_2: (a.phone_number_2 as string) ?? '',
        website: (a.website as string) ?? '',
        address: (a.address as string) ?? '',
        office_address: (a.office_address as string) ?? '',
        business_details: (a.business_details as string) ?? '',
        workplace: (a.workplace as string) ?? '',
        company: (a.company as string) ?? '',
        profile_url: (a.profile_url as string) ?? '',
        notes: (a.notes as string) ?? '',
      })
    }
    setLoading(false)
  }

  async function saveAccount() {
    const acc = caseData?.accounts as Record<string, unknown> | null
    if (!acc?.id) return
    setSavingAcc(true)
    const { error } = await supabase.from('accounts').update({
      name: accForm.name || null,
      username: accForm.username || null,
      ic_number: accForm.ic_number || null,
      email_address: accForm.email_address || null,
      phone_number: accForm.phone_number || null,
      phone_number_2: accForm.phone_number_2 || null,
      website: accForm.website || null,
      address: accForm.address || null,
      office_address: accForm.office_address || null,
      business_details: accForm.business_details || null,
      workplace: accForm.workplace || null,
      company: accForm.company || null,
      profile_url: accForm.profile_url || null,
      notes: accForm.notes || null,
    }).eq('id', acc.id as string)
    setSavingAcc(false)
    if (error) { toast.error(error.message); return }
    toast.success('Account updated')
    loadCase()
  }

  async function updateStatus(status: string) {
    setUpdatingStatus(true)
    const { error } = await supabase.from('cases').update({ status }).eq('id', caseId)
    if (error) toast.error('Failed to update status')
    else {
      toast.success('Status updated')
      setCaseData(prev => prev ? { ...prev, status } : prev)
      onUpdate()
    }
    setUpdatingStatus(false)
  }

  async function uploadEvidenceFiles(files: File[]) {
    const { data: { user } } = await supabase.auth.getUser()
    let successCount = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // Use index to guarantee unique paths even if multiple files selected at same ms
      const path = `cases/${caseId}/${Date.now()}_${i}_${file.name}`
      const { error: upErr } = await supabase.storage.from('evidence').upload(path, file)
      if (upErr) { toast.error(`Failed: ${file.name}`); continue }
      const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(path)
      await supabase.from('evidence').insert({
        case_id: caseId,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        evidence_type: file.type.startsWith('image/') ? 'screenshot' : file.type.startsWith('video/') ? 'video' : 'document',
        uploaded_by_id: user?.id ?? null,
      })
      successCount++
    }
    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`)
      loadCase()
    }
  }

  if (!open) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = caseData as any
  const priorityColour = (caseScores?.priority_colour as string) ?? 'BLUE'
  const priority = PRIORITY_LABEL[priorityColour] ?? PRIORITY_LABEL['BLUE']

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700/60 text-white overflow-hidden flex flex-col p-0 rounded-2xl shadow-2xl" style={{ width: '96vw', maxWidth: '900px', maxHeight: '93vh' }}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : !c ? (
          <div className="flex items-center justify-center h-64 text-slate-500">Case not found</div>
        ) : (
          <>
            {/* Priority stripe */}
            <div className={cn('h-1 w-full shrink-0', PRIORITY_STRIPE[priorityColour] ?? 'bg-blue-500')} />

            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-slate-700/60 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-mono text-sm font-bold text-slate-400">{c.case_number}</span>
                    <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', priority.cls)}>{priority.label}</span>
                    <SeverityBadge color={c.severity_color} />
                    <span className={cn('text-[11px] px-2 py-0.5 rounded-full border capitalize', STATUS_STYLE[c.status] ?? STATUS_STYLE['new'])}>
                      {(c.status as string).replace('_', ' ')}
                    </span>
                    {c.legal_review_recommended && (
                      <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/25">
                        <Shield className="w-3 h-3" /> Legal Review
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed line-clamp-2">{c.ai_summary ?? 'No summary'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-400 hover:text-white text-xs h-8">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Source
                      </Button>
                    </a>
                  )}
                  <Select value={c.status} onValueChange={v => v && updateStatus(v)} disabled={updatingStatus}>
                    <SelectTrigger className="w-32 bg-slate-800 border-slate-600 text-white text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s} className="text-white capitalize text-xs">{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Post metadata bar */}
              {(c.post_owner_name || c.post_datetime || c.emoji_count > 0 || c.post_comments > 0 || c.post_shares > 0) && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/40 flex-wrap">
                  {c.post_owner_name && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-200 font-medium">{c.post_owner_name}</span>
                    </div>
                  )}
                  {c.post_datetime && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{format(new Date(c.post_datetime), 'dd MMM yyyy HH:mm')}</span>
                    </div>
                  )}
                  {c.post_comments > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>{(c.post_comments as number).toLocaleString()} comments</span>
                    </div>
                  )}
                  {c.post_shares > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Share2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{(c.post_shares as number).toLocaleString()} shares</span>
                    </div>
                  )}
                  {c.emoji_count > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Smile className="w-3.5 h-3.5 text-slate-500" />
                      <span>{(c.emoji_count as number).toLocaleString()} reactions</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col min-h-0">
              <TabsList className="mx-5 mt-3 bg-slate-800/60 border border-slate-700/60 shrink-0 w-fit rounded-xl">
                {[
                  { value: 'overview', label: 'Overview', icon: LayoutGrid },
                  { value: 'account', label: 'Account', icon: Users },
                  { value: 'scores', label: 'Scores', icon: Activity },
                  { value: 'evidence', label: 'Evidence', icon: FileText },
                  { value: 'versions', label: 'Versions', icon: History },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className="text-slate-500 data-[state=active]:text-white data-[state=active]:bg-slate-700 text-xs px-3 py-1.5 rounded-lg transition-all">
                    <tab.icon className="w-3.5 h-3.5 mr-1.5" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">

                {/* Overview */}
                <TabsContent value="overview" className="space-y-4 mt-0">
                  {/* Meta grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      { label: 'Platform', value: c.platforms?.name ?? null },
                      { label: 'Source Type', value: c.source_type?.replace('_', ' ') ?? null },
                      { label: 'Date Found', value: c.date_found ? format(new Date(c.date_found), 'dd MMM yyyy') : null },
                      { label: 'Topic', value: c.topics?.name ?? null },
                    ] as { label: string; value: string | null }[]).map((row, i) => (
                      <div key={i} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">{row.label}</p>
                        <p className="text-white text-sm font-medium">{row.value ?? '—'}</p>
                      </div>
                    ))}
                  </div>

                  {/* Source URL */}
                  {c.url && (
                    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Source URL</p>
                      <a href={c.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs break-all underline underline-offset-2">
                        {c.url}
                      </a>
                    </div>
                  )}

                  {/* Summary */}
                  {c.ai_summary && (
                    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">AI Summary</p>
                      <p className="text-slate-200 text-sm leading-relaxed">{c.ai_summary}</p>
                    </div>
                  )}

                  {/* Keywords */}
                  {(c.keywords as string[] | null)?.length ? (
                    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">Extracted Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(c.keywords as string[]).map(kw => (
                          <span key={kw} className="px-2.5 py-1 bg-slate-700/60 text-slate-300 text-xs rounded-full border border-slate-600/40">{kw}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Claim text */}
                  {c.full_claim_text && (
                    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">Full Claim Text</p>
                      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{c.full_claim_text}</p>
                    </div>
                  )}

                  {/* Investigator notes */}
                  {c.initial_notes && (
                    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">Investigator Notes</p>
                      <p className="text-slate-300 text-sm">{c.initial_notes}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Account */}
                <TabsContent value="account" className="mt-0">
                  {c.accounts ? (
                    <div className="space-y-3">
                      {/* Stats row */}
                      {(() => {
                        const acc = c.accounts as Record<string, unknown>
                        return (
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'Followers', value: (acc.followers as number | null)?.toLocaleString() ?? '—' },
                              { label: 'Following', value: (acc.following as number | null)?.toLocaleString() ?? '—' },
                              { label: 'Verified', value: acc.is_verified ? 'Yes' : 'No', highlight: acc.is_verified as boolean },
                            ].map((s, i) => (
                              <div key={i} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center">
                                <p className={cn('font-bold text-lg', s.highlight ? 'text-blue-400' : 'text-white')}>{s.value}</p>
                                <p className="text-slate-500 text-xs">{s.label}</p>
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                      {/* Editable fields */}
                      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider">Account Details</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-slate-500 text-[10px] uppercase">Name</Label>
                            <Input value={accForm.name ?? ''} onChange={e => setAccForm(p => ({ ...p, name: e.target.value }))}
                              className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-slate-500 text-[10px] uppercase">Username</Label>
                            <Input value={accForm.username ?? ''} onChange={e => setAccForm(p => ({ ...p, username: e.target.value }))}
                              placeholder="@handle" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-slate-500 text-[10px] uppercase">IC / ID Number</Label>
                            <Input value={accForm.ic_number ?? ''} onChange={e => setAccForm(p => ({ ...p, ic_number: e.target.value }))}
                              placeholder="e.g. 901231-14-5678" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-slate-500 text-[10px] uppercase">Email Address</Label>
                            <Input value={accForm.email_address ?? ''} onChange={e => setAccForm(p => ({ ...p, email_address: e.target.value }))}
                              placeholder="name@email.com" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-slate-500 text-[10px] uppercase">Phone Number 1</Label>
                            <Input value={accForm.phone_number ?? ''} onChange={e => setAccForm(p => ({ ...p, phone_number: e.target.value }))}
                              placeholder="+60123456789" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-slate-500 text-[10px] uppercase">Phone Number 2</Label>
                            <Input value={accForm.phone_number_2 ?? ''} onChange={e => setAccForm(p => ({ ...p, phone_number_2: e.target.value }))}
                              placeholder="+60198765432" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-[10px] uppercase">Website</Label>
                          <Input value={accForm.website ?? ''} onChange={e => setAccForm(p => ({ ...p, website: e.target.value }))}
                            placeholder="https://..." className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-[10px] uppercase">Profile URL</Label>
                          <Input value={accForm.profile_url ?? ''} onChange={e => setAccForm(p => ({ ...p, profile_url: e.target.value }))}
                            placeholder="https://facebook.com/..." className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-[10px] uppercase">Home / Residential Address</Label>
                          <Input value={accForm.address ?? ''} onChange={e => setAccForm(p => ({ ...p, address: e.target.value }))}
                            placeholder="Street, city..." className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-[10px] uppercase">Office Address</Label>
                          <Input value={accForm.office_address ?? ''} onChange={e => setAccForm(p => ({ ...p, office_address: e.target.value }))}
                            placeholder="Office / business address..." className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-[10px] uppercase">Business Details</Label>
                          <Textarea value={accForm.business_details ?? ''} onChange={e => setAccForm(p => ({ ...p, business_details: e.target.value }))}
                            rows={2} placeholder="Business registration, type, activities..."
                            className="bg-slate-800 border-slate-700 text-white text-sm resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-slate-500 text-[10px] uppercase">Workplace</Label>
                            <Input value={accForm.workplace ?? ''} onChange={e => setAccForm(p => ({ ...p, workplace: e.target.value }))}
                              className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-slate-500 text-[10px] uppercase">Company</Label>
                            <Input value={accForm.company ?? ''} onChange={e => setAccForm(p => ({ ...p, company: e.target.value }))}
                              className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-[10px] uppercase">Notes</Label>
                          <Textarea value={accForm.notes ?? ''} onChange={e => setAccForm(p => ({ ...p, notes: e.target.value }))}
                            rows={2} placeholder="Additional notes..."
                            className="bg-slate-800 border-slate-700 text-white text-sm resize-none" />
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button onClick={saveAccount} disabled={savingAcc} size="sm" className="bg-teal-700 hover:bg-teal-600 text-white">
                            {savingAcc ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                            Save Account
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                      <Users className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">No account information linked</p>
                    </div>
                  )}
                </TabsContent>

                {/* Scores */}
                <TabsContent value="scores" className="space-y-4 mt-0">
                  {/* Legal Review Banner */}
                  {caseScores && (caseScores.legal_review_status as string) !== 'Not Required' && (
                    <div className={cn('flex items-start gap-3 p-4 rounded-xl border', (caseScores.legal_review_status as string) === 'Urgent Legal Review' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30')}>
                      <AlertTriangle className={cn('w-5 h-5 shrink-0 mt-0.5', (caseScores.legal_review_status as string) === 'Urgent Legal Review' ? 'text-red-400' : 'text-yellow-400')} />
                      <div>
                        <p className={cn('font-semibold text-sm', (caseScores.legal_review_status as string) === 'Urgent Legal Review' ? 'text-red-400' : 'text-yellow-400')}>
                          {caseScores.legal_review_status as string}
                        </p>
                        {(caseScores.score_explanation as string | null) && (
                          <p className="text-slate-300 text-xs mt-1 leading-relaxed">{caseScores.score_explanation as string}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {caseScores ? (
                    <>
                      {/* Overall */}
                      <div className="bg-gradient-to-r from-slate-800 to-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-white font-semibold">Overall Priority Score</p>
                            <p className="text-slate-500 text-xs mt-0.5">Weighted combination of all 6 dimensions</p>
                          </div>
                          <span className={cn('text-4xl font-black tabular-nums', priority.cls.split(' ')[0])}>{caseScores.overall_priority_score as number ?? 0}</span>
                        </div>
                        <ScoreBar score={caseScores.overall_priority_score as number | null} size="md" />
                      </div>

                      {/* 6-dimension grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { label: 'Claim Seriousness', key: 'claim_seriousness_score', desc: 'Severity of allegation', icon: AlertTriangle },
                          { label: 'Reputation Impact', key: 'reputation_impact_score', desc: 'Damage to public image', icon: Shield },
                          { label: 'Influence', key: 'influence_score', desc: 'Author reach & visibility', icon: Users },
                          { label: 'Evidence Strength', key: 'evidence_strength_score', desc: 'E1 allegation → E5 court doc', icon: FileText },
                          { label: 'Narrative Amplification', key: 'narrative_amplification_score', desc: 'Repetition across posts', icon: Activity },
                          { label: 'Legal Exposure', key: 'legal_exposure_score', desc: 'Entity + harmful = exposure', icon: CheckCircle2 },
                        ] as { label: string; key: string; desc: string; icon: React.ElementType }[]).map(item => (
                          <div key={item.key} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <item.icon className="w-3.5 h-3.5 text-slate-500" />
                                <p className="text-slate-300 text-xs font-medium">{item.label}</p>
                              </div>
                              <span className="text-xl font-bold text-white tabular-nums">{(caseScores[item.key] as number) ?? 0}</span>
                            </div>
                            <ScoreBar score={caseScores[item.key] as number | null} size="sm" />
                            <p className="text-slate-600 text-[10px] mt-1.5">{item.desc}</p>
                          </div>
                        ))}
                      </div>

                      {/* Detected Entities */}
                      {keywordMatches.filter(m => (m.keywords as Record<string, unknown>)?.keyword_type === 'Entity').length > 0 && (
                        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
                          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-3">Detected Entities</p>
                          <div className="flex flex-wrap gap-2">
                            {keywordMatches
                              .filter(m => (m.keywords as Record<string, unknown>)?.keyword_type === 'Entity')
                              .map(m => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const kw = m.keywords as any
                                return (
                                  <span key={m.id as string} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 border border-slate-600/40 rounded-full text-slate-300 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                    {kw.keyword}
                                    <span className="text-slate-500 text-[10px]">×{m.frequency as number}</span>
                                  </span>
                                )
                              })}
                          </div>
                        </div>
                      )}

                      {/* Harmful Keywords */}
                      {keywordMatches.filter(m => ['Allegation', 'Reputation Attack', 'Financial', 'Legal', 'Business Dispute'].includes((m.keywords as Record<string, unknown>)?.keyword_type as string)).length > 0 && (
                        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
                          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-3">Harmful Keywords Detected</p>
                          <div className="space-y-1.5">
                            {keywordMatches
                              .filter(m => ['Allegation', 'Reputation Attack', 'Financial', 'Legal', 'Business Dispute'].includes((m.keywords as Record<string, unknown>)?.keyword_type as string))
                              .map(m => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const kw = m.keywords as any
                                const colorMap: Record<string, string> = {
                                  RED: 'text-red-300 bg-red-500/10 border-red-500/20',
                                  YELLOW: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
                                  BLUE: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
                                  GREY: 'text-slate-400 bg-slate-700/40 border-slate-600/30',
                                  ORANGE: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
                                }
                                return (
                                  <div key={m.id as string} className={cn('flex items-center justify-between px-3 py-2 rounded-lg border', colorMap[kw.color_tag] ?? colorMap['GREY'])}>
                                    <div className="flex items-center gap-2">
                                      {kw.is_legal_flag && <Shield className="w-3 h-3 shrink-0" />}
                                      <span className="font-mono text-sm">{kw.keyword}</span>
                                      <span className="text-[10px] opacity-50">{kw.keyword_type}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] opacity-60">
                                      <span>×{m.frequency as number}</span>
                                      {kw.seriousness_score > 0 && <span>S:{kw.seriousness_score}</span>}
                                      {kw.reputation_score > 0 && <span>R:{kw.reputation_score}</span>}
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                      <Activity className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">No scores yet</p>
                      <p className="text-xs mt-1">Run AI evaluation to generate scores</p>
                    </div>
                  )}

                  <p className="text-slate-600 text-[10px] leading-relaxed border border-slate-700/30 rounded-xl p-3">
                    AI-generated scoring is an internal risk assessment only. It does not determine truth, guilt, defamation, criminality, or legal liability. Final assessment must be made by qualified human reviewers or legal professionals.
                  </p>
                </TabsContent>

                {/* Evidence */}
                <TabsContent value="evidence" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm">{evidenceList.length} file(s)</p>
                    <label className="cursor-pointer">
                      <input type="file" multiple className="hidden"
                        onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) uploadEvidenceFiles(files) }} />
                      <Button size="sm" className="bg-slate-700 hover:bg-slate-600 text-white pointer-events-none">
                        <Upload className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    </label>
                  </div>
                  {evidenceList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                      <FileText className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">No evidence uploaded yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {evidenceList.map(ev => (
                        <div key={ev.id} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
                          {ev.evidence_type === 'screenshot' ? (
                            <img src={(ev as unknown as Record<string, string>).file_url} alt={ev.file_name}
                              className="w-full h-32 object-cover rounded-lg mb-2 bg-slate-700" />
                          ) : (
                            <div className="w-full h-32 bg-slate-700/60 rounded-lg mb-2 flex items-center justify-center">
                              <FileText className="w-8 h-8 text-slate-500" />
                            </div>
                          )}
                          <p className="text-white text-xs font-medium truncate">{ev.file_name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-slate-500 text-xs">{ev.evidence_type}</span>
                            <a href={(ev as unknown as Record<string, string>).file_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3.5 h-3.5 text-slate-500 hover:text-white" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Version Log */}
                <TabsContent value="versions" className="mt-0">
                  {versions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                      <History className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">No version history yet</p>
                    </div>
                  ) : (
                    <div className="relative pl-8">
                      <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-700/60" />
                      <div className="space-y-3">
                        {versions.map(v => (
                          <div key={v.id} className="relative">
                            <div className="absolute -left-5 top-3 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-slate-900" />
                            <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-400">v{v.version_number}</span>
                                  <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">{v.change_type.replace(/_/g, ' ')}</span>
                                </div>
                                <span className="text-slate-500 text-xs">{format(new Date(v.date_captured), 'dd MMM yyyy HH:mm')}</span>
                              </div>
                              {v.description && <p className="text-slate-300 text-sm">{v.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

              </div>
            </Tabs>

            {/* Footer */}
            <div className="border-t border-slate-700/40 px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
              <span>Created {c.created_at ? format(new Date(c.created_at), 'dd MMM yyyy HH:mm') : '—'}</span>
              <span>Updated {c.updated_at ? format(new Date(c.updated_at), 'dd MMM yyyy HH:mm') : '—'}</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
