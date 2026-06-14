'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SeverityBadge } from './severity-badge'
import { ScoreBar } from './score-bar'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ExternalLink, Upload, Clock, Shield, FileText, Users, Activity, History, Loader2 } from 'lucide-react'
import type { Case, PostVersion, Evidence, Engagement } from '@/types'
import { toast } from 'sonner'

interface Props {
  caseId: string
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

const STATUS_OPTIONS = ['new', 'under_review', 'verified', 'dismissed', 'escalated', 'closed']

export function CaseDetailModal({ caseId, open, onClose, onUpdate }: Props) {
  const supabase = createClient()
  const [caseData, setCaseData] = useState<Record<string, unknown> | null>(null)
  const [versions, setVersions] = useState<PostVersion[]>([])
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([])
  const [engagement, setEngagement] = useState<Engagement | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)

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
    ] = await Promise.all([
      supabase.from('cases').select(`
        *, platforms(name), topics(name), severity_levels(name, color, description),
        accounts(*, account_types(name)),
        profiles!assigned_investigator_id(full_name, email)
      `).eq('id', caseId).single(),
      supabase.from('post_versions').select('*, profiles!uploaded_by_id(full_name, email)').eq('case_id', caseId).order('version_number'),
      supabase.from('evidence').select('*, profiles!uploaded_by_id(full_name, email)').eq('case_id', caseId).order('created_at'),
      supabase.from('engagements').select('*').eq('case_id', caseId).order('capture_date', { ascending: false }).limit(1).maybeSingle(),
    ])
    setCaseData(c)
    setVersions((v ?? []) as unknown as PostVersion[])
    setEvidenceList((e ?? []) as unknown as Evidence[])
    setEngagement(eng as Engagement | null)
    setLoading(false)
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

  async function uploadEvidence(file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    const path = `cases/${caseId}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('evidence').upload(path, file)
    if (upErr) { toast.error('Upload failed'); return }
    const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(path)
    await supabase.from('evidence').insert({
      case_id: caseId,
      file_url: publicUrl,
      file_name: file.name,
      file_type: file.type,
      evidence_type: file.type.startsWith('image/') ? 'screenshot' : file.type.startsWith('video/') ? 'video' : 'document',
      uploaded_by_id: user?.id ?? null,
    })
    toast.success('Evidence uploaded')
    loadCase()
  }

  if (!open) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = caseData as any

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : !c ? (
          <div className="flex items-center justify-center h-64 text-slate-500">Case not found</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-700">
              <div className="flex items-start gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-red-400 font-bold">{c.case_number as string}</span>
                    <SeverityBadge color={c.severity_color as import('@/types').SeverityColor | null} />
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300`}>
                      {(c.status as string).replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm max-w-xl">{c.ai_summary as string ?? 'No summary'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.url && (
                  <a href={c.url as string} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="border-slate-600 text-slate-400 hover:text-white text-xs">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Source
                    </Button>
                  </a>
                )}
                <Select value={c.status as string} onValueChange={v => v && updateStatus(v)} disabled={updatingStatus}>
                  <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-white text-xs">
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

            {/* Tabs */}
            <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="mx-5 mt-3 bg-slate-800 border border-slate-700 shrink-0 w-fit">
                {[
                  { value: 'overview', label: 'Overview', icon: Shield },
                  { value: 'account', label: 'Account', icon: Users },
                  { value: 'scores', label: 'Scores', icon: Activity },
                  { value: 'evidence', label: 'Evidence', icon: FileText },
                  { value: 'versions', label: 'Versions', icon: History },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700 text-xs px-3 py-1.5">
                    <tab.icon className="w-3.5 h-3.5 mr-1.5" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto p-5">

                {/* SECTION A+B: Overview */}
                <TabsContent value="overview" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { label: 'Platform', value: (c.platforms as Record<string, string> | null)?.name ?? null },
                        { label: 'Source Type', value: (c.source_type as string)?.replace('_', ' ') ?? null },
                        { label: 'Date Found', value: c.date_found ? format(new Date(c.date_found as string), 'dd MMM yyyy') : null },
                        { label: 'Date Posted', value: c.date_posted ? format(new Date(c.date_posted as string), 'dd MMM yyyy') : null },
                        { label: 'Topic', value: (c.topics as Record<string, string> | null)?.name ?? null },
                        { label: 'Claim Category', value: (c.claim_category as string) ?? null },
                        { label: 'Severity', value: null, custom: <SeverityBadge color={c.severity_color as import('@/types').SeverityColor | null} /> },
                      ] as Array<{ label: string; value: string | null; custom?: React.ReactNode }>
                    ).map((row, i) => (
                      <div key={i} className="bg-slate-800 rounded-lg p-3">
                        <p className="text-slate-500 text-xs mb-1">{row.label}</p>
                        {row.custom ?? <p className="text-white text-sm">{row.value ?? '—'}</p>}
                      </div>
                    ))}
                  </div>

                  {c.full_claim_text && (
                    <div className="bg-slate-800 rounded-lg p-4">
                      <p className="text-slate-500 text-xs mb-2 uppercase tracking-wide">Full Claim Text</p>
                      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{c.full_claim_text as string}</p>
                    </div>
                  )}

                  {(c.keywords as string[] | null)?.length ? (
                    <div>
                      <p className="text-slate-500 text-xs mb-2 uppercase tracking-wide">Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(c.keywords as string[]).map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">{kw}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {c.initial_notes && (
                    <div className="bg-slate-800 rounded-lg p-4">
                      <p className="text-slate-500 text-xs mb-2 uppercase tracking-wide">Investigator Notes</p>
                      <p className="text-slate-300 text-sm">{c.initial_notes as string}</p>
                    </div>
                  )}
                </TabsContent>

                {/* SECTION C: Account */}
                <TabsContent value="account" className="space-y-4 mt-0">
                  {c.accounts ? (() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const acc = c.accounts as any
                    const vs = (status: string) => ({
                      verified: 'text-green-400 bg-green-500/10',
                      publicly_sourced: 'text-blue-400 bg-blue-500/10',
                      unverified: 'text-slate-500 bg-slate-700/50',
                    })[status as string] ?? 'text-slate-500 bg-slate-700/50'

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl">
                          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 text-lg font-bold">
                            {(acc.name as string | null)?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <p className="text-white font-semibold">{acc.name as string ?? 'Unknown'}</p>
                            {acc.username && <p className="text-slate-400 text-sm">@{acc.username as string}</p>}
                            {acc.account_types && (
                              <Badge className="mt-1 bg-slate-700 text-slate-300 text-xs">{(acc.account_types as Record<string, string>).name}</Badge>
                            )}
                          </div>
                          {acc.profile_url && (
                            <a href={acc.profile_url as string} target="_blank" rel="noopener noreferrer" className="ml-auto">
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-slate-800 rounded-lg p-3 text-center">
                            <p className="text-white font-bold">{(acc.followers as number | null)?.toLocaleString() ?? '—'}</p>
                            <p className="text-slate-500 text-xs">Followers</p>
                          </div>
                          <div className="bg-slate-800 rounded-lg p-3 text-center">
                            <p className="text-white font-bold">{(acc.following as number | null)?.toLocaleString() ?? '—'}</p>
                            <p className="text-slate-500 text-xs">Following</p>
                          </div>
                          <div className="bg-slate-800 rounded-lg p-3 text-center">
                            <p className={`font-bold ${acc.is_verified ? 'text-blue-400' : 'text-slate-500'}`}>
                              {acc.is_verified ? 'Verified' : 'Not Verified'}
                            </p>
                            <p className="text-slate-500 text-xs">Platform Status</p>
                          </div>
                        </div>

                        {(
                          [
                            { label: 'Workplace', value: acc.workplace as string | null, status: acc.workplace_status as string },
                            { label: 'Company', value: acc.company as string | null, status: acc.company_status as string },
                            { label: 'Phone', value: acc.phone_number as string | null, status: acc.phone_status as string },
                            { label: 'Address', value: acc.address as string | null, status: acc.address_status as string },
                          ] as { label: string; value: string | null; status: string }[]
                        ).filter(f => f.value).map((field, i) => (
                          <div key={i} className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                            <div>
                              <p className="text-slate-500 text-xs">{field.label}</p>
                              <p className="text-white text-sm">{field.value}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${vs(field.status)}`}>
                              {field.status?.replace('_', ' ')}
                            </span>
                          </div>
                        ))}

                        {acc.notes && (
                          <div className="bg-slate-800 rounded-lg p-3">
                            <p className="text-slate-500 text-xs mb-1">Notes</p>
                            <p className="text-slate-300 text-sm">{acc.notes as string}</p>
                          </div>
                        )}
                      </div>
                    )
                  })() : (
                    <div className="text-center py-12 text-slate-600">No account information linked</div>
                  )}
                </TabsContent>

                {/* SECTION E: Scores */}
                <TabsContent value="scores" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 gap-3">
                    {(
                      [
                        { label: 'Overall Risk Score', score: c.overall_risk_score as number | null, desc: 'Combined weighted risk assessment' },
                        { label: 'Claim Seriousness Score', score: c.claim_seriousness_score as number | null, desc: 'Based on severity, evidence, influence, specificity, repetition' },
                        { label: 'Evidence Strength Score', score: c.evidence_strength_score as number | null, desc: 'Quality and type of supporting evidence' },
                        { label: 'Influence Score', score: c.influence_score as number | null, desc: 'Reach and impact of the account' },
                        { label: 'Engagement Score', score: c.engagement_score as number | null, desc: 'Likes, shares, comments, views velocity' },
                      ] as { label: string; score: number | null; desc: string }[]
                    ).map((item, i) => (
                      <div key={i} className="bg-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-white text-sm font-medium">{item.label}</p>
                          <span className="text-2xl font-bold text-white tabular-nums">
                            {item.score != null ? Math.round(item.score as number) : '—'}
                          </span>
                        </div>
                        <ScoreBar score={item.score as number | null} size="md" />
                        <p className="text-slate-500 text-xs mt-2">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  {engagement && (
                    <div className="bg-slate-800 rounded-xl p-4">
                      <p className="text-white font-medium text-sm mb-3">Engagement Data</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Likes', value: engagement.likes },
                          { label: 'Comments', value: engagement.comments },
                          { label: 'Shares', value: engagement.shares },
                          { label: 'Views', value: engagement.views },
                          { label: 'Reposts', value: engagement.reposts },
                          { label: 'Saves', value: engagement.saves },
                        ].map((e, i) => (
                          <div key={i} className="text-center">
                            <p className="text-white font-bold">{e.value.toLocaleString()}</p>
                            <p className="text-slate-500 text-xs">{e.label}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-slate-600 text-xs mt-3">
                        Captured: {format(new Date(engagement.capture_date), 'dd MMM yyyy')}
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Evidence Vault */}
                <TabsContent value="evidence" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm">{evidenceList.length} file(s) uploaded</p>
                    <label className="cursor-pointer">
                      <input type="file" multiple className="hidden"
                        onChange={e => Array.from(e.target.files ?? []).forEach(f => uploadEvidence(f))} />
                      <Button size="sm" className="bg-slate-700 hover:bg-slate-600 text-white pointer-events-none">
                        <Upload className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    </label>
                  </div>

                  {evidenceList.length === 0 ? (
                    <div className="text-center py-12 text-slate-600">No evidence uploaded yet</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {evidenceList.map(ev => (
                        <div key={ev.id} className="bg-slate-800 rounded-lg p-3">
                          {ev.evidence_type === 'screenshot' ? (
                            <img src={(ev as unknown as Record<string, string>).file_url} alt={ev.file_name}
                              className="w-full h-32 object-cover rounded-md mb-2 bg-slate-700" />
                          ) : (
                            <div className="w-full h-32 bg-slate-700 rounded-md mb-2 flex items-center justify-center">
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
                          {ev.description && <p className="text-slate-500 text-xs mt-1">{ev.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Version Log */}
                <TabsContent value="versions" className="space-y-4 mt-0">
                  {versions.length === 0 ? (
                    <div className="text-center py-12 text-slate-600">No version history yet</div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700" />
                      <div className="space-y-4">
                        {versions.map(v => (
                          <div key={v.id} className="flex gap-4 relative pl-10">
                            <div className="absolute left-3 top-1.5 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-slate-900" />
                            <div className="flex-1 bg-slate-800 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-400">v{v.version_number}</span>
                                  <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
                                    {v.change_type.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <span className="text-slate-500 text-xs">
                                  {format(new Date(v.date_captured), 'dd MMM yyyy HH:mm')}
                                </span>
                              </div>
                              {v.screenshot_url && (
                                <img src={v.screenshot_url} alt={`Version ${v.version_number}`}
                                  className="w-full max-h-48 object-cover rounded-lg mb-2 bg-slate-700" />
                              )}
                              {v.description && <p className="text-slate-300 text-sm">{v.description}</p>}
                              {v.notes && <p className="text-slate-500 text-xs mt-1">{v.notes}</p>}
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
            <div className="border-t border-slate-700 px-5 py-3 flex items-center justify-between text-xs text-slate-600">
              <span>Created {c.created_at ? format(new Date(c.created_at as string), 'dd MMM yyyy HH:mm') : '—'}</span>
              <span>Updated {c.updated_at ? format(new Date(c.updated_at as string), 'dd MMM yyyy HH:mm') : '—'}</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
