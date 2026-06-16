'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Sparkles, CheckCircle2, AlertCircle,
  Image as ImageIcon, X, Link2, Bot, Shield,
  TrendingUp, FileText, Copy, AlertTriangle, Plus
} from 'lucide-react'
import type { Platform, Topic, SeverityColor } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AddPostModalProps {
  open: boolean
  onClose: () => void
  platforms: Platform[]
  topics: Topic[]
  onSuccess: () => void
}

interface DetectedKeyword {
  keyword_id: string
  keyword: string
  keyword_type: string
  frequency: number
  seriousness_score: number
  reputation_score: number
  color_tag: string
  is_legal_flag: boolean
}

interface AIEvaluation {
  engagement_score?: number
  engagement_level?: string
  engagement_colour?: string
  summary: string
  claim_category: string
  suggested_topic: string
  severity: SeverityColor
  severity_reasoning: string
  evidence_level: string
  evidence_reasoning: string
  influence_level: number
  keywords: string[]
  duplicate_notes: string
  overall_risk_score?: number
  post_owner_name?: string | null
  post_datetime?: string | null
  emoji_count?: number
  post_comments?: number
  post_shares?: number
  entities?: DetectedKeyword[]
  harmful_keywords?: DetectedKeyword[]
  claim_seriousness_score?: number
  reputation_impact_score?: number
  influence_score?: number
  evidence_strength_score?: number
  narrative_amplification_score?: number
  legal_exposure_score?: number
  overall_priority_score?: number
  priority_colour?: string
  legal_review_status?: string
  score_explanation?: string
  account_username?: string | null
  account_profile_url?: string | null
  account_followers?: number | null
  account_is_verified?: boolean
}

const SEV_CFG: Record<SeverityColor, { bg: string; text: string; border: string; label: string; dot: string }> = {
  RED:    { bg: 'rgba(220,38,38,0.12)',  text: '#F87171', border: 'rgba(220,38,38,0.3)',  label: 'Red — High',     dot: '#DC2626' },
  YELLOW: { bg: 'rgba(202,138,4,0.12)',  text: '#FCD34D', border: 'rgba(202,138,4,0.3)',  label: 'Yellow — Medium', dot: '#CA8A04' },
  BLUE:   { bg: 'rgba(37,99,235,0.12)',  text: '#60A5FA', border: 'rgba(37,99,235,0.3)',  label: 'Blue — Low',     dot: '#2563EB' },
  GREY:   { bg: 'rgba(100,116,139,0.12)',text: '#94A3B8', border: 'rgba(100,116,139,0.3)',label: 'Grey — Unclear', dot: '#64748B' },
}

const INFLUENCE_LABELS = ['', 'Minimal', 'Low', 'Medium', 'High', 'Critical']

const HARMFUL_COLOR: Record<string, string> = {
  RED:    'rgba(220,38,38,0.15)',
  ORANGE: 'rgba(234,88,12,0.15)',
  YELLOW: 'rgba(202,138,4,0.15)',
  BLUE:   'rgba(37,99,235,0.15)',
  GREY:   'rgba(100,116,139,0.12)',
}
const HARMFUL_TEXT: Record<string, string> = {
  RED: '#F87171', ORANGE: '#FB923C', YELLOW: '#FCD34D', BLUE: '#60A5FA', GREY: '#94A3B8',
}

export function AddPostModal({ open, onClose, platforms, topics, onSuccess }: AddPostModalProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [aiResult, setAiResult] = useState<AIEvaluation | null>(null)
  const [editedSummary, setEditedSummary] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [accounts, setAccounts] = useState<{ id: string; name: string | null; username: string | null }[]>([])
  const [saveExtractedAccount, setSaveExtractedAccount] = useState(true)

  useEffect(() => {
    supabase.from('accounts').select('id, name, username').order('name').then(({ data }) => setAccounts(data ?? []))
  }, [])

  const [form, setForm] = useState({
    platform_id: '',
    account_id: '',
    url: '',
    source_type: 'post_owner' as 'post_owner' | 'commenter',
    initial_notes: '',
    screenshots: [] as File[],
    focus_subject: '',
    focus_comment: '',
  })
  const [accDetails, setAccDetails] = useState({
    ic_number: '', email_address: '', phone_number: '', phone_number_2: '',
    website: '', address: '', office_address: '', business_details: '',
  })

  function reset() {
    setForm({ platform_id: '', account_id: '', url: '', source_type: 'post_owner', initial_notes: '', screenshots: [], focus_subject: '', focus_comment: '' })
    setAccDetails({ ic_number: '', email_address: '', phone_number: '', phone_number_2: '', website: '', address: '', office_address: '', business_details: '' })
    setAiResult(null)
    setConfirmed(false)
  }

  function handleClose() { reset(); onClose() }

  function addScreenshots(files: File[]) {
    setForm(f => ({ ...f, screenshots: [...f.screenshots, ...files] }))
  }

  function removeScreenshot(index: number) {
    setForm(f => ({ ...f, screenshots: f.screenshots.filter((_, i) => i !== index) }))
  }

  async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
    // Resize to max 1280px wide at 85% quality — keeps text readable while cutting payload size ~80%
    return new Promise(resolve => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const MAX = 1280
        let { width, height } = img
        if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const [, data] = dataUrl.split(',')
        resolve({ data, mediaType: 'image/jpeg' })
      }
      img.src = objectUrl
    })
  }

  async function runEvaluation() {
    setEvaluating(true)
    setAiResult(null)
    try {
      const platform = platforms.find(p => p.id === form.platform_id)
      // Convert all screenshots to base64 — send all to AI
      const images: { data: string; mediaType: string }[] = []
      for (const file of form.screenshots) {
        const converted = await fileToBase64(file)
        images.push(converted)
      }
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.url, platform: platform?.name, notes: form.initial_notes, images, focusSubject: form.focus_subject || null, focusComment: form.focus_comment || null }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiResult(data)
      setEditedSummary(data.summary ?? '')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[CIT] AI eval error:', err)
      toast.error(`AI evaluation failed: ${msg}`, { duration: 10000 })
    } finally {
      setEvaluating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Upload all screenshots; first one is primary (used for AI + post_versions)
      const uploadedFiles: { url: string; file: File }[] = []
      for (let i = 0; i < form.screenshots.length; i++) {
        const file = form.screenshots[i]
        const path = `cases/${Date.now()}_${i}_${file.name.replace(/\s+/g, '_')}`
        const { data: uploaded } = await supabase.storage.from('evidence').upload(path, file)
        if (uploaded) {
          const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(path)
          uploadedFiles.push({ url: publicUrl, file })
        }
      }
      const screenshotUrl = uploadedFiles[0]?.url ?? null

      const { data: severity } = aiResult
        ? await supabase.from('severity_levels').select('id').eq('color', aiResult.severity).single()
        : { data: null }

      const matchedTopic = aiResult
        ? topics.find(t => t.name.toLowerCase() === aiResult.suggested_topic?.toLowerCase())
        : null

      // Auto-create account from AI extraction, focus subject, or manual details if no account selected
      let resolvedAccountId = form.account_id || null
      const hasAiAccount = saveExtractedAccount && aiResult && (aiResult.post_owner_name || aiResult.account_username)
      const hasFocusSubject = !!form.focus_subject.trim()
      const hasManualDetails = Object.values(accDetails).some(v => v.trim())
      if (!resolvedAccountId && (hasAiAccount || hasFocusSubject || hasManualDetails)) {
        // Focus subject name takes priority; fall back to AI-extracted name
        const accountName = hasFocusSubject
          ? form.focus_subject.trim()
          : (aiResult?.post_owner_name ?? null)
        const { data: newAccount } = await supabase.from('accounts').insert({
          name: accountName,
          username: aiResult?.account_username ?? null,
          profile_url: aiResult?.account_profile_url ?? null,
          followers: aiResult?.account_followers ?? null,
          is_verified: aiResult?.account_is_verified ?? false,
          ic_number: accDetails.ic_number || null,
          email_address: accDetails.email_address || null,
          phone_number: accDetails.phone_number || null,
          phone_number_2: accDetails.phone_number_2 || null,
          website: accDetails.website || null,
          address: accDetails.address || null,
          office_address: accDetails.office_address || null,
          business_details: accDetails.business_details || null,
        }).select('id').single()
        if (newAccount) resolvedAccountId = newAccount.id
      } else if (resolvedAccountId && hasManualDetails) {
        // Update existing selected account with any filled details
        await supabase.from('accounts').update({
          ic_number: accDetails.ic_number || null,
          email_address: accDetails.email_address || null,
          phone_number: accDetails.phone_number || null,
          phone_number_2: accDetails.phone_number_2 || null,
          website: accDetails.website || null,
          address: accDetails.address || null,
          office_address: accDetails.office_address || null,
          business_details: accDetails.business_details || null,
        }).eq('id', resolvedAccountId)
      }

      const { data: newCase, error } = await supabase.from('cases').insert({
        platform_id: form.platform_id || null,
        account_id: resolvedAccountId,
        url: form.url || null,
        source_type: form.source_type,
        initial_notes: form.initial_notes || null,
        ai_summary: editedSummary || aiResult?.summary || null,
        claim_category: aiResult?.claim_category ?? null,
        topic_id: matchedTopic?.id ?? null,
        keywords: aiResult?.keywords ?? null,
        severity_id: severity?.id ?? null,
        severity_color: aiResult?.severity ?? null,
        influence_level: aiResult?.influence_level ?? null,
        overall_risk_score: aiResult?.overall_risk_score ?? null,
        ai_evaluated: !!aiResult,
        ai_confirmed: !!aiResult,
        assigned_investigator_id: user?.id ?? null,
        created_by_id: user?.id ?? null,
        post_owner_name: aiResult?.post_owner_name ?? null,
        post_datetime: aiResult?.post_datetime ?? null,
        emoji_count: aiResult?.emoji_count ?? 0,
        post_comments: aiResult?.post_comments ?? 0,
        post_shares: aiResult?.post_shares ?? 0,
        focus_subject: form.focus_subject || null,
        focus_comment: form.focus_comment || null,
      }).select().single()

      if (error) throw error

      if (screenshotUrl && newCase) {
        // Primary screenshot → post_versions record
        await supabase.from('post_versions').insert({
          case_id: newCase.id, change_type: 'original_post',
          screenshot_url: screenshotUrl, description: 'Initial capture', uploaded_by_id: user?.id ?? null,
        })
        // All uploaded files → evidence records
        if (uploadedFiles.length > 0) {
          await supabase.from('evidence').insert(
            uploadedFiles.map(({ url, file }, idx) => ({
              case_id: newCase.id,
              file_url: url,
              file_name: file.name,
              file_type: file.type,
              evidence_type: file.type.startsWith('video/') ? 'video' : 'screenshot',
              description: idx === 0 ? 'Primary screenshot' : `Additional screenshot ${idx + 1}`,
              uploaded_by_id: user?.id ?? null,
            }))
          )
        }
      }

      // Save scores and keyword matches now that we have a caseId
      if (newCase && aiResult) {
        const now = new Date().toISOString()
        const caseId = (newCase as Record<string, string>).id

        await supabase.from('case_scores').upsert({
          case_id: caseId,
          claim_seriousness_score: aiResult.claim_seriousness_score ?? 0,
          reputation_impact_score: aiResult.reputation_impact_score ?? 0,
          influence_score: aiResult.influence_score ?? 0,
          evidence_strength_score: aiResult.evidence_strength_score ?? 0,
          narrative_amplification_score: aiResult.narrative_amplification_score ?? 0,
          legal_exposure_score: aiResult.legal_exposure_score ?? 0,
          overall_priority_score: aiResult.overall_priority_score ?? aiResult.overall_risk_score ?? 0,
          priority_colour: aiResult.priority_colour ?? 'BLUE',
          legal_review_status: aiResult.legal_review_status ?? 'Not Required',
          score_explanation: aiResult.score_explanation ?? null,
          detected_entities: aiResult.entities ?? [],
          detected_harmful: aiResult.harmful_keywords ?? [],
          updated_at: now,
        }, { onConflict: 'case_id' })

        const allKeywords = [...(aiResult.entities ?? []), ...(aiResult.harmful_keywords ?? [])]
        if (allKeywords.length > 0) {
          await supabase.from('case_keyword_matches').upsert(
            allKeywords.map(k => ({
              case_id: caseId,
              keyword_id: k.keyword_id,
              frequency: k.frequency,
              detected_from: 'ai_evaluation',
              first_detected_at: now,
            })),
            { onConflict: 'case_id,keyword_id' }
          )
        }

        await supabase.from('cases').update({
          keyword_heat_score: aiResult.overall_priority_score ?? aiResult.overall_risk_score ?? 0,
          legal_review_recommended: aiResult.legal_review_status !== 'Not Required',
        }).eq('id', caseId)
      }

      toast.success(`Case ${(newCase as Record<string, string>).case_number} created`)
      handleClose()
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save case')
    } finally {
      setSaving(false)
    }
  }

  const engageCls: Record<string, { bg: string; text: string }> = {
    Critical: { bg: 'rgba(220,38,38,0.15)', text: '#F87171' },
    High:     { bg: 'rgba(234,88,12,0.15)', text: '#FB923C' },
    Medium:   { bg: 'rgba(202,138,4,0.15)', text: '#FCD34D' },
    Low:      { bg: 'rgba(37,99,235,0.15)', text: '#60A5FA' },
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="text-white p-0 gap-0 border overflow-hidden"
        style={{
          width: '92vw',
          maxWidth: '1400px',
          height: '88vh',
          background: '#0D1B2A',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#0F766E,#0D9488)' }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white" style={{ fontSize: 16 }}>Add &amp; Evaluate Post</h2>
              <p className="text-xs" style={{ color: '#64748B' }}>Fill in post details, then run AI analysis</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.06]" style={{ color: '#64748B' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Form */}
          <div className="flex flex-col overflow-y-auto" style={{ width: '42%', minWidth: 360, borderRight: '1px solid rgba(255,255,255,0.07)', padding: '24px 28px' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#0F766E' }}>Post Information</p>

            {/* Platform + Source */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: '#64748B' }}>Platform <span style={{ color: '#DC2626' }}>*</span></Label>
                <Select value={form.platform_id} onValueChange={v => setForm(f => ({ ...f, platform_id: v ?? '' }))}>
                  <SelectTrigger className="h-9 text-sm border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#F1F5F9' }}>
                    <SelectValue placeholder="Select...">
                      {platforms.find(p => p.id === form.platform_id)?.name ?? 'Select...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {platforms.map(p => <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: '#64748B' }}>Source Type</Label>
                <Select value={form.source_type} onValueChange={v => setForm(f => ({ ...f, source_type: (v ?? 'post_owner') as 'post_owner' | 'commenter' }))}>
                  <SelectTrigger className="h-9 text-sm border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#F1F5F9' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <SelectItem value="post_owner" className="text-white">Post Owner</SelectItem>
                    <SelectItem value="commenter" className="text-white">Commenter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Account */}
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: '#64748B' }}>Account (Perpetrator)</Label>
              <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v ?? '' }))}>
                <SelectTrigger className="h-9 text-sm border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#F1F5F9' }}>
                  <SelectValue placeholder="Select account...">
                    {accounts.find(a => a.id === form.account_id)
                      ? `${accounts.find(a => a.id === form.account_id)?.name ?? ''}${accounts.find(a => a.id === form.account_id)?.username ? ` (@${accounts.find(a => a.id === form.account_id)?.username})` : ''}`
                      : 'Select account...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <SelectItem value="" className="text-slate-500">— None —</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-white">
                      {a.name ?? a.username ?? a.id}{a.username ? ` (@${a.username})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Focus Subject */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#FCD34D' }}>Focus Subject</span>
                <span className="text-[10px]" style={{ color: '#64748B' }}>(optional — for commenter cases)</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide" style={{ color: '#94A3B8' }}>Name / Handle</label>
                <input
                  value={form.focus_subject}
                  onChange={e => setForm(f => ({ ...f, focus_subject: e.target.value }))}
                  placeholder="e.g. Nurul Izzaty or @nurulainieyasin"
                  className="w-full h-9 px-3 rounded-lg text-sm text-white bg-transparent placeholder:text-slate-600 focus:outline-none"
                  style={{ border: '1px solid rgba(251,191,36,0.3)' }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide" style={{ color: '#94A3B8' }}>Paste their comment <span style={{ color: '#64748B' }}>(optional but recommended)</span></label>
                <textarea
                  value={form.focus_comment}
                  onChange={e => setForm(f => ({ ...f, focus_comment: e.target.value }))}
                  rows={3}
                  placeholder="Copy and paste the exact comment text here so the AI has no ambiguity about which comment to analyze..."
                  className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent placeholder:text-slate-600 focus:outline-none resize-none"
                  style={{ border: '1px solid rgba(251,191,36,0.3)' }}
                />
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>
                If the screenshot has many comments, pasting the exact text ensures the AI analyses the right one.
              </p>
            </div>

            {/* Account Details */}
            <div className="rounded-xl p-4 mb-2 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>Account Details <span className="normal-case font-normal">(optional — saved with account)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase" style={{ color: '#64748B' }}>IC / ID Number</Label>
                  <input value={accDetails.ic_number} onChange={e => setAccDetails(p => ({ ...p, ic_number: e.target.value }))}
                    placeholder="e.g. 901231-14-5678"
                    className="w-full h-8 px-3 rounded-lg text-sm text-white bg-transparent border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-white/20" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase" style={{ color: '#64748B' }}>Email Address</Label>
                  <input value={accDetails.email_address} onChange={e => setAccDetails(p => ({ ...p, email_address: e.target.value }))}
                    placeholder="name@email.com"
                    className="w-full h-8 px-3 rounded-lg text-sm text-white bg-transparent border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-white/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase" style={{ color: '#64748B' }}>Phone Number 1</Label>
                  <input value={accDetails.phone_number} onChange={e => setAccDetails(p => ({ ...p, phone_number: e.target.value }))}
                    placeholder="+60123456789"
                    className="w-full h-8 px-3 rounded-lg text-sm text-white bg-transparent border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-white/20" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase" style={{ color: '#64748B' }}>Phone Number 2</Label>
                  <input value={accDetails.phone_number_2} onChange={e => setAccDetails(p => ({ ...p, phone_number_2: e.target.value }))}
                    placeholder="+60198765432"
                    className="w-full h-8 px-3 rounded-lg text-sm text-white bg-transparent border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-white/20" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase" style={{ color: '#64748B' }}>Website</Label>
                <input value={accDetails.website} onChange={e => setAccDetails(p => ({ ...p, website: e.target.value }))}
                  placeholder="https://..."
                  className="w-full h-8 px-3 rounded-lg text-sm text-white bg-transparent border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-white/20" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase" style={{ color: '#64748B' }}>Home / Residential Address</Label>
                <input value={accDetails.address} onChange={e => setAccDetails(p => ({ ...p, address: e.target.value }))}
                  placeholder="Street, city..."
                  className="w-full h-8 px-3 rounded-lg text-sm text-white bg-transparent border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-white/20" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase" style={{ color: '#64748B' }}>Office Address</Label>
                <input value={accDetails.office_address} onChange={e => setAccDetails(p => ({ ...p, office_address: e.target.value }))}
                  placeholder="Office / business address..."
                  className="w-full h-8 px-3 rounded-lg text-sm text-white bg-transparent border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-white/20" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase" style={{ color: '#64748B' }}>Business Details</Label>
                <textarea value={accDetails.business_details} onChange={e => setAccDetails(p => ({ ...p, business_details: e.target.value }))}
                  rows={2} placeholder="Business registration, type, activities..."
                  className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-white/20 resize-none" />
              </div>
            </div>

            {/* URL */}
            <div className="space-y-1.5 mb-4">
              <Label className="text-xs" style={{ color: '#64748B' }}>Post URL</Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#475569' }} />
                <Input
                  placeholder="https://..."
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className="pl-8 h-9 text-sm border"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#F1F5F9' }}
                />
              </div>
            </div>

            {/* Screenshots — multi-image, first one used for AI */}
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs" style={{ color: '#64748B' }}>
                  Screenshots <span style={{ color: '#DC2626' }}>*</span>
                  <span className="ml-1 font-normal" style={{ color: '#475569' }}>(first image used for AI analysis)</span>
                </Label>
                {form.screenshots.length > 0 && (
                  <span className="text-xs" style={{ color: '#0F766E' }}>{form.screenshots.length} file{form.screenshots.length > 1 ? 's' : ''}</span>
                )}
              </div>

              {form.screenshots.length === 0 ? (
                <label className="flex flex-col items-center justify-center rounded-xl cursor-pointer transition-colors"
                  style={{ border: '2px dashed rgba(255,255,255,0.12)', minHeight: 120, background: 'rgba(255,255,255,0.02)' }}>
                  <input type="file" accept="image/*,video/*" multiple className="hidden"
                    onChange={e => addScreenshots(Array.from(e.target.files ?? []))} />
                  <ImageIcon className="w-7 h-7 mb-2 opacity-30" style={{ color: '#475569' }} />
                  <p className="text-xs" style={{ color: '#475569' }}>Click to upload — select multiple at once</p>
                </label>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {form.screenshots.map((f, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden"
                      style={{ width: 72, height: 72, border: i === 0 ? '2px solid rgba(15,118,110,0.6)' : '2px solid rgba(255,255,255,0.08)' }}>
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-semibold py-0.5"
                          style={{ background: 'rgba(15,118,110,0.85)', color: '#fff' }}>AI</div>
                      )}
                      <button type="button" onClick={() => removeScreenshot(i)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(220,38,38,0.9)' }}>
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                    style={{ width: 72, height: 72, border: '2px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)', color: '#475569' }}>
                    <input type="file" multiple accept="image/*,video/*" className="hidden"
                      onChange={e => addScreenshots(Array.from(e.target.files ?? []))} />
                    <Plus className="w-5 h-5" />
                  </label>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: '#64748B' }}>Initial Notes <span style={{ color: '#475569', fontWeight: 400 }}>(Optional)</span></Label>
              <Textarea
                placeholder="Initial observations about this post..."
                value={form.initial_notes}
                onChange={e => setForm(f => ({ ...f, initial_notes: e.target.value }))}
                className="text-sm border resize-none"
                rows={4}
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#F1F5F9' }}
              />
            </div>
          </div>

          {/* RIGHT: AI Panel */}
          <div className="flex flex-col flex-1 overflow-y-auto" style={{ padding: '24px 28px' }}>
            <div className="flex items-center gap-2 mb-5">
              <Bot className="w-4 h-4" style={{ color: '#0F766E' }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#0F766E' }}>AI Evaluation</p>
            </div>

            {/* Empty state */}
            {!evaluating && !aiResult && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(15,118,110,0.12)', border: '1px solid rgba(15,118,110,0.2)' }}>
                  <Sparkles className="w-6 h-6" style={{ color: '#0F766E' }} />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1" style={{ fontSize: 15 }}>Ready to Analyse</p>
                  <p className="text-xs" style={{ color: '#64748B', maxWidth: 260, margin: '0 auto' }}>
                    Fill in the post details and upload a screenshot, then run AI evaluation to extract metadata and score the post.
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-2 mt-2">
                  {['Extract post metadata (author, date, reactions)', 'Detect entities & harmful keywords', 'Score 6 intelligence dimensions', 'Flag legal review if needed'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-left" style={{ color: '#64748B' }}>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#0F766E' }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evaluating */}
            {evaluating && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#0F766E' }} />
                <p className="text-white font-medium" style={{ fontSize: 15 }}>Analysing Post...</p>
                <p className="text-xs" style={{ color: '#64748B' }}>Extracting text · Classifying claim · Scoring dimensions</p>
              </div>
            )}

            {/* Results */}
            {aiResult && !evaluating && (
              <div className="space-y-4">

                {/* Post Metadata */}
                {(aiResult.post_owner_name || aiResult.post_datetime || (aiResult.post_comments ?? 0) > 0 || (aiResult.post_shares ?? 0) > 0 || (aiResult.emoji_count ?? 0) > 0) && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.2)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#2DD4BF' }}>Extracted Post Metadata</p>
                      {aiResult.engagement_level && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
                          style={{ background: engageCls[aiResult.engagement_level]?.bg ?? 'rgba(37,99,235,0.15)', color: engageCls[aiResult.engagement_level]?.text ?? '#60A5FA' }}>
                          {aiResult.engagement_level} · {aiResult.engagement_score}/100
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {aiResult.post_owner_name && <MetaCell label="Author" value={aiResult.post_owner_name} />}
                      {aiResult.post_datetime && <MetaCell label="Posted" value={new Date(aiResult.post_datetime).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })} />}
                      {(aiResult.emoji_count ?? 0) > 0 && <MetaCell label="Reactions" value={(aiResult.emoji_count ?? 0).toLocaleString()} />}
                      {(aiResult.post_comments ?? 0) > 0 && <MetaCell label="Comments" value={(aiResult.post_comments ?? 0).toLocaleString()} />}
                      {(aiResult.post_shares ?? 0) > 0 && <MetaCell label="Shares" value={(aiResult.post_shares ?? 0).toLocaleString()} />}
                    </div>
                  </div>
                )}

                {/* Extracted Account */}
                {(aiResult.post_owner_name || aiResult.account_username) && !form.account_id && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#A78BFA' }}>Extracted Account</p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={saveExtractedAccount} onChange={e => setSaveExtractedAccount(e.target.checked)}
                          className="accent-violet-500 w-3.5 h-3.5" />
                        <span className="text-xs" style={{ color: '#A78BFA' }}>Save as Account record</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' }}>
                        {(aiResult.post_owner_name ?? aiResult.account_username ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        {aiResult.post_owner_name && <p className="text-white text-sm font-medium">{aiResult.post_owner_name}</p>}
                        {aiResult.account_username && <p className="text-slate-400 text-xs">@{aiResult.account_username}</p>}
                        {aiResult.account_followers && <p className="text-slate-500 text-xs">{aiResult.account_followers.toLocaleString()} followers</p>}
                      </div>
                      {aiResult.account_is_verified && (
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.2)', color: '#60A5FA' }}>✓ Verified</span>
                      )}
                    </div>
                    {saveExtractedAccount && (
                      <p className="text-xs mt-2" style={{ color: '#6D28D9' }}>This account will be created and linked when you save the case.</p>
                    )}
                  </div>
                )}

                {/* Scores row */}
                <div className="grid grid-cols-3 gap-3">
                  <ScoreCard label="Overall Priority" value={aiResult.overall_priority_score ?? aiResult.overall_risk_score ?? 0} />
                  <ScoreCard label="Claim Seriousness" value={aiResult.claim_seriousness_score ?? 0} />
                  <ScoreCard label="Reputation Impact" value={aiResult.reputation_impact_score ?? 0} />
                </div>

                {/* Severity + Topic + Evidence */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] mb-2" style={{ color: '#64748B' }}>SEVERITY</p>
                    <SeverityPill color={aiResult.severity} />
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] mb-2" style={{ color: '#64748B' }}>TOPIC</p>
                    <p className="text-xs text-white font-medium truncate">{aiResult.suggested_topic}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] mb-2" style={{ color: '#64748B' }}>EVIDENCE</p>
                    <p className="text-xs font-semibold" style={{ color: '#F1F5F9' }}>{aiResult.evidence_level}</p>
                    <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: '#64748B' }}>{aiResult.evidence_reasoning}</p>
                  </div>
                </div>

                {/* Summary — editable */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(15,118,110,0.3)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: '#64748B' }}>Claim Summary</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(15,118,110,0.15)', color: '#2DD4BF' }}>Editable</span>
                  </div>
                  <textarea
                    value={editedSummary}
                    onChange={e => setEditedSummary(e.target.value)}
                    rows={4}
                    className="w-full text-sm leading-relaxed resize-none outline-none bg-transparent"
                    style={{ color: '#CBD5E1', caretColor: '#2DD4BF' }}
                  />
                </div>

                {/* Entities */}
                {(aiResult.entities?.length ?? 0) > 0 && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] mb-2.5 uppercase tracking-wide" style={{ color: '#64748B' }}>Detected Entities</p>
                    <div className="flex flex-wrap gap-2">
                      {aiResult.entities!.map(e => (
                        <span key={e.keyword_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#64748B' }} />
                          {e.keyword}
                          <span style={{ color: '#475569', fontSize: 10 }}>×{e.frequency}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Harmful Keywords */}
                {(aiResult.harmful_keywords?.length ?? 0) > 0 && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] mb-2.5 uppercase tracking-wide" style={{ color: '#64748B' }}>Harmful Keywords</p>
                    <div className="flex flex-wrap gap-2">
                      {aiResult.harmful_keywords!.map(k => (
                        <span key={k.keyword_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: HARMFUL_COLOR[k.color_tag] ?? HARMFUL_COLOR['GREY'], border: `1px solid ${(HARMFUL_TEXT[k.color_tag] ?? '#94A3B8') + '40'}`, color: HARMFUL_TEXT[k.color_tag] ?? '#94A3B8' }}>
                          {k.is_legal_flag && <Shield className="w-3 h-3 shrink-0" />}
                          {k.keyword}
                          <span style={{ opacity: 0.5, fontSize: 10 }}>×{k.frequency}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legal Review */}
                {aiResult.legal_review_status && aiResult.legal_review_status !== 'Not Required' && (
                  <div className="flex items-start gap-3 rounded-xl p-4"
                    style={{
                      background: aiResult.legal_review_status === 'Urgent Legal Review' ? 'rgba(127,29,29,0.2)' : 'rgba(202,138,4,0.12)',
                      border: `1px solid ${aiResult.legal_review_status === 'Urgent Legal Review' ? 'rgba(220,38,38,0.35)' : 'rgba(202,138,4,0.35)'}`,
                    }}>
                    <Shield className="w-4 h-4 shrink-0 mt-0.5" style={{ color: aiResult.legal_review_status === 'Urgent Legal Review' ? '#F87171' : '#FCD34D' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: aiResult.legal_review_status === 'Urgent Legal Review' ? '#F87171' : '#FCD34D' }}>
                        {aiResult.legal_review_status}
                      </p>
                      {aiResult.score_explanation && (
                        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{aiResult.score_explanation}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* AI keywords */}
                {aiResult.keywords.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] mb-2.5 uppercase tracking-wide" style={{ color: '#64748B' }}>AI Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiResult.keywords.map(kw => (
                        <span key={kw} className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duplicate note */}
                {aiResult.duplicate_notes && aiResult.duplicate_notes !== 'none' && (
                  <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)' }}>
                    <Copy className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#FB923C' }} />
                    <p className="text-xs" style={{ color: '#FB923C' }}>{aiResult.duplicate_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(13,27,42,0.8)' }}>
          <button onClick={handleClose} className="text-sm px-4 py-2 rounded-lg transition-colors" style={{ color: '#64748B' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F1F5F9')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}>
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {!aiResult && (
              <button onClick={handleSave} disabled={saving}
                className="text-sm px-4 py-2 rounded-lg transition-colors"
                style={{ color: '#64748B', opacity: saving ? 0.5 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#F1F5F9')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}>
                {saving ? 'Saving...' : 'Skip AI & Save'}
              </button>
            )}
            {!aiResult ? (
              <button onClick={runEvaluation} disabled={evaluating || !form.platform_id || form.screenshots.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#0F766E,#0D9488)', boxShadow: '0 4px 16px rgba(15,118,110,0.3)' }}>
                {evaluating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing...</>
                  : <><Sparkles className="w-4 h-4" /> Run AI Evaluation</>
                }
              </button>
            ) : (
              <>
                <button onClick={runEvaluation} disabled={evaluating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>
                  {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Re-analyse
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0F766E,#0D9488)', boxShadow: '0 4px 16px rgba(15,118,110,0.3)' }}>
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    : <><CheckCircle2 className="w-4 h-4" /> Confirm &amp; Save Case</>
                  }
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SeverityPill({ color }: { color: SeverityColor }) {
  const cfg = SEV_CFG[color]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-xs font-medium text-white truncate">{value}</p>
    </div>
  )
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? '#DC2626' : value >= 50 ? '#EA580C' : value >= 25 ? '#CA8A04' : '#2563EB'
  const bg = value >= 75 ? 'rgba(220,38,38,0.1)' : value >= 50 ? 'rgba(234,88,12,0.1)' : value >= 25 ? 'rgba(202,138,4,0.1)' : 'rgba(37,99,235,0.1)'
  const border = value >= 75 ? 'rgba(220,38,38,0.25)' : value >= 50 ? 'rgba(234,88,12,0.25)' : value >= 25 ? 'rgba(202,138,4,0.25)' : 'rgba(37,99,235,0.25)'
  return (
    <div className="rounded-xl p-3 flex flex-col" style={{ background: bg, border: `1px solid ${border}` }}>
      <p className="text-[10px] mb-1.5" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums leading-none" style={{ color }}>
        {value}<span className="text-xs font-normal" style={{ color: '#475569' }}>/100</span>
      </p>
    </div>
  )
}
