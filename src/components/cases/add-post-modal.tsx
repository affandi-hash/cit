'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Sparkles, CheckCircle2, AlertCircle,
  Image as ImageIcon, X, Link2, Bot, AlertTriangle,
  FileText, TrendingUp, Shield, Copy
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

interface AIEvaluation {
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
}

const SEVERITY_CONFIG: Record<SeverityColor, { bg: string; text: string; border: string; label: string }> = {
  RED:    { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30',    label: 'Red (High)' },
  YELLOW: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Yellow (Medium)' },
  BLUE:   { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30',   label: 'Blue (Low)' },
  GREY:   { bg: 'bg-slate-600/20',  text: 'text-slate-400',  border: 'border-slate-600/30',  label: 'Grey (Unclear)' },
}

const INFLUENCE_LABELS = ['', 'Minimal (L1)', 'Low (L2)', 'Medium (L3)', 'High (L4)', 'Critical (L5)']

type TabId = 'info' | 'ai' | 'confirm'

export function AddPostModal({ open, onClose, platforms, topics, onSuccess }: AddPostModalProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [aiResult, setAiResult] = useState<AIEvaluation | null>(null)

  const [form, setForm] = useState<{
    platform_id: string
    url: string
    source_type: 'post_owner' | 'commenter'
    initial_notes: string
    screenshot: File | null
    additional_files: File[]
    screenshotPreview: string | null
  }>({
    platform_id: '',
    url: '',
    source_type: 'post_owner',
    initial_notes: '',
    screenshot: null,
    additional_files: [],
    screenshotPreview: null,
  })

  function reset() {
    setActiveTab('info')
    setForm({ platform_id: '', url: '', source_type: 'post_owner', initial_notes: '', screenshot: null, additional_files: [], screenshotPreview: null })
    setAiResult(null)
  }

  function handleClose() { reset(); onClose() }

  function handleScreenshot(file: File) {
    const reader = new FileReader()
    reader.onload = e => setForm(f => ({ ...f, screenshot: file, screenshotPreview: e.target?.result as string }))
    reader.readAsDataURL(file)
  }

  async function runEvaluation() {
    setEvaluating(true)
    try {
      const platform = platforms.find(p => p.id === form.platform_id)
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.url, platform: platform?.name, notes: form.initial_notes }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiResult(data)
      setActiveTab('ai')
    } catch {
      toast.error('AI evaluation failed. You can still save manually.')
    } finally {
      setEvaluating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      let screenshotUrl: string | null = null
      if (form.screenshot) {
        const path = `cases/${Date.now()}_${form.screenshot.name.replace(/\s+/g, '_')}`
        const { data: uploaded } = await supabase.storage.from('evidence').upload(path, form.screenshot)
        if (uploaded) {
          const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(path)
          screenshotUrl = publicUrl
        }
      }

      const { data: severity } = aiResult
        ? await supabase.from('severity_levels').select('id').eq('color', aiResult.severity).single()
        : { data: null }

      const matchedTopic = aiResult
        ? topics.find(t => t.name.toLowerCase() === aiResult.suggested_topic?.toLowerCase())
        : null

      const { data: newCase, error } = await supabase.from('cases').insert({
        platform_id: form.platform_id || null,
        url: form.url || null,
        source_type: form.source_type,
        initial_notes: form.initial_notes || null,
        ai_summary: aiResult?.summary ?? null,
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
      }).select().single()

      if (error) throw error

      if (screenshotUrl && newCase) {
        await Promise.all([
          supabase.from('post_versions').insert({
            case_id: newCase.id,
            change_type: 'original_post',
            screenshot_url: screenshotUrl,
            description: 'Initial capture',
            uploaded_by_id: user?.id ?? null,
          }),
          supabase.from('evidence').insert({
            case_id: newCase.id,
            file_url: screenshotUrl,
            file_name: form.screenshot!.name,
            file_type: form.screenshot!.type,
            evidence_type: 'screenshot',
            description: 'Original screenshot',
            uploaded_by_id: user?.id ?? null,
          }),
        ])
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

  const tabs: { id: TabId; label: string; step: number }[] = [
    { id: 'info', label: '1. Post Information', step: 1 },
    { id: 'ai', label: '2. AI Evaluation (Preview)', step: 2 },
    { id: 'confirm', label: '3. Confirm & Save', step: 3 },
  ]

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white w-[95vw] max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <h2 className="text-lg font-bold text-white">Add & Evaluate Post</h2>
          <button onClick={handleClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 px-6 pt-4 border-b border-slate-800">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => tab.id === 'ai' && aiResult ? setActiveTab(tab.id) : tab.id === 'info' ? setActiveTab(tab.id) : tab.id === 'confirm' && aiResult ? setActiveTab(tab.id) : null}
              className={cn(
                'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body — single column */}
        <div className="flex flex-1 overflow-hidden">

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Tab: Post Information */}
            {(activeTab === 'info' || activeTab === 'ai') && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-4">Post Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 text-xs">Platform <span className="text-red-400">*</span></Label>
                      <Select value={form.platform_id} onValueChange={v => setForm(f => ({ ...f, platform_id: v ?? '' }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm h-9">
                          <SelectValue placeholder="Select...">
                            {platforms.find(p => p.id === form.platform_id)?.name ?? 'Select...'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {platforms.map(p => <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 text-xs">Source Type <span className="text-red-400">*</span></Label>
                      <Select value={form.source_type} onValueChange={v => setForm(f => ({ ...f, source_type: (v ?? 'post_owner') as 'post_owner' | 'commenter' }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="post_owner" className="text-white">Post Owner</SelectItem>
                          <SelectItem value="commenter" className="text-white">Commenter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Post URL <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <Input
                      placeholder="https://..."
                      value={form.url}
                      onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                      className="pl-8 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm h-9"
                    />
                  </div>
                  <p className="text-slate-600 text-xs">Paste the full URL of the post</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">Evidence Upload</Label>
                  <div className="space-y-1.5">
                    <p className="text-slate-500 text-xs">Original Screenshot <span className="text-red-400">*</span></p>
                    <label className={cn(
                      'flex items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors overflow-hidden',
                      form.screenshotPreview ? 'border-green-500/40 h-auto' : 'h-28 border-slate-700 hover:border-blue-500/50'
                    )}>
                      <input type="file" accept="image/*,video/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleScreenshot(f) }} />
                      {form.screenshotPreview ? (
                        <div className="relative w-full">
                          <img src={form.screenshotPreview} alt="preview" className="w-full max-h-40 object-cover" />
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded text-xs text-green-400">
                            <CheckCircle2 className="w-3 h-3" /> {form.screenshot?.name}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-slate-600">
                          <ImageIcon className="w-7 h-7 mx-auto mb-1.5 opacity-50" />
                          <p className="text-xs">Click to upload screenshot</p>
                        </div>
                      )}
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-slate-500 text-xs">Additional Screenshots / Videos <span className="text-slate-600">(Optional)</span></p>
                    <div className="flex gap-2 flex-wrap">
                      {form.additional_files.map((f, i) => (
                        <div key={i} className="w-16 h-16 bg-slate-800 rounded-lg overflow-hidden relative group">
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setForm(prev => ({ ...prev, additional_files: prev.additional_files.filter((_, j) => j !== i) }))}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ))}
                      <label className="w-16 h-16 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors">
                        <input type="file" multiple accept="image/*,video/*" className="hidden"
                          onChange={e => setForm(f => ({ ...f, additional_files: [...f.additional_files, ...Array.from(e.target.files ?? [])] }))} />
                        <span className="text-slate-600 text-xl font-light">+</span>
                      </label>
                      <p className="text-slate-600 text-xs self-end pb-1">You can upload more evidence after saving the case</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Initial Notes <span className="text-slate-600">(Optional)</span></Label>
                  <Textarea
                    placeholder="Initial capture of the post. Add any observations..."
                    value={form.initial_notes}
                    onChange={e => setForm(f => ({ ...f, initial_notes: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm min-h-[72px] resize-none"
                  />
                </div>
              </>
            )}

            {/* AI Results inline — shown on ai tab */}
            {activeTab === 'ai' && (
              <div className="mt-2">
                {evaluating && (
                  <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                    <p className="text-slate-400 text-sm">Analyzing post with AI...</p>
                  </div>
                )}
                {aiResult && !evaluating && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4 text-blue-400" />
                      <h3 className="text-sm font-semibold text-slate-200">AI Evaluation Results</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {aiResult.summary && (
                        <div className="col-span-full p-3 bg-slate-800/60 rounded-lg">
                          <p className="text-slate-500 text-xs mb-1">Claim Summary</p>
                          <p className="text-slate-200 text-sm leading-relaxed">{aiResult.summary}</p>
                        </div>
                      )}
                      <div className="p-3 bg-slate-800/60 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Suggested Severity</p>
                        <SeverityPill color={aiResult.severity} />
                      </div>
                      <div className="p-3 bg-slate-800/60 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Suggested Topic</p>
                        <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs rounded-full border border-blue-500/25">{aiResult.suggested_topic}</span>
                      </div>
                      <div className="p-3 bg-slate-800/60 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Evidence Strength</p>
                        <p className="text-slate-300 text-xs">{aiResult.evidence_level} — {aiResult.evidence_reasoning}</p>
                      </div>
                      <div className="p-3 bg-slate-800/60 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Influence Level</p>
                        <p className={cn('text-xs font-medium', aiResult.influence_level >= 4 ? 'text-orange-400' : aiResult.influence_level >= 3 ? 'text-yellow-400' : 'text-slate-300')}>
                          {INFLUENCE_LABELS[aiResult.influence_level] ?? `Level ${aiResult.influence_level}`}
                        </p>
                      </div>
                      {aiResult.overall_risk_score !== undefined && (
                        <div className="p-3 bg-slate-800/60 rounded-lg">
                          <p className="text-slate-500 text-xs mb-1">Risk Score</p>
                          <p className={cn('text-xl font-bold tabular-nums', aiResult.overall_risk_score >= 75 ? 'text-red-400' : aiResult.overall_risk_score >= 50 ? 'text-yellow-400' : aiResult.overall_risk_score >= 25 ? 'text-blue-400' : 'text-slate-400')}>
                            {aiResult.overall_risk_score}<span className="text-slate-600 text-xs font-normal"> / 100</span>
                          </p>
                        </div>
                      )}
                    </div>
                    {aiResult.keywords.length > 0 && (
                      <div className="p-3 bg-slate-800/60 rounded-lg">
                        <p className="text-slate-500 text-xs mb-2">Keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiResult.keywords.map(kw => <span key={kw} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">{kw}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Confirm & Save */}
            {activeTab === 'confirm' && aiResult && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 text-sm font-medium">Human Confirmation Required</p>
                    <p className="text-amber-400/70 text-xs mt-0.5">Review AI suggestions before saving. You can update any field after creation.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'URL', value: form.url },
                    { label: 'Platform', value: platforms.find(p => p.id === form.platform_id)?.name },
                    { label: 'Source Type', value: form.source_type.replace('_', ' ') },
                    { label: 'AI Summary', value: aiResult.summary },
                    { label: 'Severity', value: null, custom: <SeverityPill color={aiResult.severity} /> },
                    { label: 'Topic', value: aiResult.suggested_topic },
                    { label: 'Evidence Level', value: `${aiResult.evidence_level} — ${aiResult.evidence_reasoning}` },
                    { label: 'Influence', value: INFLUENCE_LABELS[aiResult.influence_level] ?? `Level ${aiResult.influence_level}` },
                  ].map((row, i) => (
                    <div key={i} className="flex gap-3 py-2 border-b border-slate-800 last:border-0">
                      <span className="text-slate-500 text-xs w-28 shrink-0 pt-0.5">{row.label}</span>
                      {row.custom ?? <span className="text-slate-200 text-sm flex-1">{row.value ?? '—'}</span>}
                    </div>
                  ))}
                </div>

                {aiResult.keywords.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs mb-2">Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiResult.keywords.map(kw => (
                        <span key={kw} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: AI Quick Preview — hidden, results shown inline */}
          <div className="hidden">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-200">AI Quick Preview</h3>
            </div>

            {!aiResult && !evaluating && (
              <div className="flex-1 flex flex-col">
                <div className="flex items-start gap-2 p-3 bg-slate-800/60 rounded-lg mb-4">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-slate-400 text-xs leading-relaxed">
                    AI will analyze the post and provide suggestions. You can review and edit before saving.
                  </p>
                </div>

                {/* Placeholder rows */}
                {['Extracted Text (Preview)', 'Claim Summary (AI)', 'Suggested Topic (AI)', 'Suggested Severity (AI)', 'Evidence Strength (AI)', 'Influence Level (AI)', 'Estimated Overall Risk Score (AI)', 'Potential Duplicate'].map(label => (
                  <div key={label} className="py-2.5 border-b border-slate-800 last:border-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-3 h-3 rounded-sm bg-slate-700" />
                      <p className="text-slate-600 text-xs">{label}</p>
                    </div>
                    <div className="h-3 bg-slate-800 rounded w-3/4" />
                  </div>
                ))}
              </div>
            )}

            {evaluating && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-slate-400 text-sm">Analyzing post...</p>
                <p className="text-slate-600 text-xs text-center">Extracting text, classifying claim, scoring severity</p>
              </div>
            )}

            {aiResult && (
              <div className="flex-1 space-y-3">
                {aiResult.summary && (
                  <AIRow icon={<FileText className="w-3.5 h-3.5 text-slate-400" />} label="Claim Summary (AI)">
                    <p className="text-slate-300 text-xs leading-relaxed">{aiResult.summary}</p>
                  </AIRow>
                )}

                <AIRow icon={<div className="w-3.5 h-3.5 rounded-sm bg-blue-500/30 flex items-center justify-center"><span className="text-[8px] text-blue-400 font-bold">T</span></div>} label="Suggested Topic (AI)">
                  <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs rounded-full border border-blue-500/25">
                    {aiResult.suggested_topic}
                  </span>
                </AIRow>

                <AIRow icon={<AlertTriangle className="w-3.5 h-3.5 text-slate-400" />} label="Suggested Severity (AI)">
                  <SeverityPill color={aiResult.severity} />
                </AIRow>

                <AIRow icon={<Shield className="w-3.5 h-3.5 text-slate-400" />} label="Evidence Strength (AI)">
                  <span className="text-slate-300 text-xs">{aiResult.evidence_level} — {aiResult.evidence_reasoning}</span>
                </AIRow>

                <AIRow icon={<TrendingUp className="w-3.5 h-3.5 text-slate-400" />} label="Influence Level (AI)">
                  <span className={cn(
                    'text-xs font-medium',
                    aiResult.influence_level >= 4 ? 'text-orange-400' : aiResult.influence_level >= 3 ? 'text-yellow-400' : 'text-slate-400'
                  )}>
                    {INFLUENCE_LABELS[aiResult.influence_level] ?? `Level ${aiResult.influence_level}`}
                  </span>
                </AIRow>

                {aiResult.overall_risk_score !== undefined && (
                  <AIRow icon={<Sparkles className="w-3.5 h-3.5 text-slate-400" />} label="Est. Overall Risk Score (AI)">
                    <span className={cn(
                      'text-sm font-bold tabular-nums',
                      aiResult.overall_risk_score >= 75 ? 'text-red-400' :
                      aiResult.overall_risk_score >= 50 ? 'text-yellow-400' :
                      aiResult.overall_risk_score >= 25 ? 'text-blue-400' : 'text-slate-400'
                    )}>
                      {aiResult.overall_risk_score} <span className="text-slate-600 text-xs font-normal">/ 100</span>
                    </span>
                  </AIRow>
                )}

                {aiResult.duplicate_notes && aiResult.duplicate_notes !== 'none' && (
                  <AIRow icon={<Copy className="w-3.5 h-3.5 text-amber-400" />} label="Potential Duplicate">
                    <p className="text-amber-400 text-xs">{aiResult.duplicate_notes}</p>
                  </AIRow>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <Button variant="ghost" onClick={handleClose} className="text-slate-500 hover:text-white text-sm h-9">
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            {activeTab === 'info' && (
              <Button
                onClick={runEvaluation}
                disabled={evaluating || !form.platform_id}
                className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-6"
              >
                {evaluating
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                  : <><Sparkles className="w-4 h-4 mr-2" /> Next: AI Evaluation</>
                }
              </Button>
            )}
            {activeTab === 'ai' && (
              <>
                <Button variant="outline" onClick={() => setActiveTab('info')}
                  className="border-slate-700 text-slate-400 hover:text-white h-9">
                  Back
                </Button>
                <Button onClick={() => setActiveTab('confirm')}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-6">
                  Review & Confirm
                </Button>
              </>
            )}
            {activeTab === 'confirm' && (
              <>
                <Button variant="outline" onClick={() => setActiveTab('ai')}
                  className="border-slate-700 text-slate-400 hover:text-white h-9">
                  Back
                </Button>
                <Button onClick={handleSave} disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-6">
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm & Save Case</>
                  }
                </Button>
              </>
            )}
            {activeTab === 'info' && !aiResult && (
              <Button variant="ghost" onClick={handleSave} disabled={saving}
                className="text-slate-500 hover:text-white text-sm h-9">
                Skip AI & Save
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SeverityPill({ color }: { color: SeverityColor }) {
  const cfg = SEVERITY_CONFIG[color]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border', cfg.bg, cfg.text, cfg.border)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', color === 'RED' ? 'bg-red-500' : color === 'YELLOW' ? 'bg-yellow-500' : color === 'BLUE' ? 'bg-blue-500' : 'bg-slate-500')} />
      {cfg.label}
    </span>
  )
}

function AIRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-slate-800/70 last:border-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-slate-500 text-xs">{label}</p>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  )
}
