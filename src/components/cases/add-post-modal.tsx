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
  Upload, Loader2, Sparkles, CheckCircle2, AlertCircle,
  ChevronRight, ChevronLeft, Image, X
} from 'lucide-react'
import type { Platform, Topic } from '@/types'
import { toast } from 'sonner'

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
  severity: 'RED' | 'YELLOW' | 'BLUE' | 'GREY'
  severity_reasoning: string
  evidence_level: string
  evidence_reasoning: string
  influence_level: number
  keywords: string[]
  duplicate_notes: string
}

export function AddPostModal({ open, onClose, platforms, topics, onSuccess }: AddPostModalProps) {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [aiResult, setAiResult] = useState<AIEvaluation | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const [form, setForm] = useState<{
    platform_id: string
    url: string
    source_type: 'post_owner' | 'commenter'
    initial_notes: string
    screenshot: File | null
    additional_files: File[]
  }>({
    platform_id: '',
    url: '',
    source_type: 'post_owner' as 'post_owner' | 'commenter',
    initial_notes: '',
    screenshot: null as File | null,
    additional_files: [] as File[],
  })

  function reset() {
    setStep(1)
    setForm({ platform_id: '', url: '', source_type: 'post_owner', initial_notes: '', screenshot: null, additional_files: [] })
    setAiResult(null)
    setConfirmed(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function runAIEvaluation() {
    setEvaluating(true)
    try {
      const platform = platforms.find(p => p.id === form.platform_id)
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: form.url,
          platform: platform?.name,
          notes: form.initial_notes,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiResult(data)
      setStep(3)
    } catch (err) {
      toast.error('AI evaluation failed. Please try again.')
    } finally {
      setEvaluating(false)
    }
  }

  async function handleSubmit() {
    if (!aiResult) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Upload screenshot
      let screenshotUrl: string | null = null
      if (form.screenshot) {
        const path = `cases/${Date.now()}_${form.screenshot.name}`
        const { data: uploaded } = await supabase.storage.from('evidence').upload(path, form.screenshot)
        if (uploaded) {
          const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(path)
          screenshotUrl = publicUrl
        }
      }

      // Find severity ID
      const { data: severity } = await supabase
        .from('severity_levels')
        .select('id')
        .eq('color', aiResult.severity)
        .single()

      // Find topic ID if matched
      const matchedTopic = topics.find(t => t.name.toLowerCase() === aiResult.suggested_topic?.toLowerCase())

      // Create case
      const { data: newCase, error } = await supabase.from('cases').insert({
        platform_id: form.platform_id || null,
        url: form.url || null,
        source_type: form.source_type,
        initial_notes: form.initial_notes || null,
        ai_summary: aiResult.summary,
        claim_category: aiResult.claim_category,
        topic_id: matchedTopic?.id ?? null,
        keywords: aiResult.keywords,
        severity_id: severity?.id ?? null,
        severity_color: aiResult.severity,
        influence_level: aiResult.influence_level,
        ai_evaluated: true,
        ai_confirmed: true,
        assigned_investigator_id: user?.id ?? null,
        created_by_id: user?.id ?? null,
      }).select().single()

      if (error) throw error

      // Create initial version
      if (screenshotUrl && newCase) {
        await supabase.from('post_versions').insert({
          case_id: newCase.id,
          change_type: 'original_post',
          screenshot_url: screenshotUrl,
          description: 'Initial capture',
          uploaded_by_id: user?.id ?? null,
        })

        await supabase.from('evidence').insert({
          case_id: newCase.id,
          file_url: screenshotUrl,
          file_name: form.screenshot!.name,
          file_type: form.screenshot!.type,
          evidence_type: 'screenshot',
          description: 'Original screenshot',
          uploaded_by_id: user?.id ?? null,
        })
      }

      toast.success(`Case ${newCase.case_number} created successfully`)
      handleClose()
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create case')
    } finally {
      setLoading(false)
    }
  }

  const severityConfig = {
    RED: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
    YELLOW: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' },
    BLUE: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' },
    GREY: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' },
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-red-400" />
            Add & Evaluate Post
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {['Source Info', 'Evidence', 'AI Review'].map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step > i + 1 ? 'bg-green-600 text-white' : step === i + 1 ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-500'}`}>
                {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs ${step === i + 1 ? 'text-white' : 'text-slate-500'}`}>{label}</span>
              {i < 2 && <div className="flex-1 h-px bg-slate-700" />}
            </div>
          ))}
        </div>

        {/* Step 1: Source Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Platform</Label>
              <Select value={form.platform_id} onValueChange={v => setForm(f => ({ ...f, platform_id: v ?? '' }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select platform..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {platforms.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-white hover:bg-slate-700">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">URL</Label>
              <Input
                placeholder="https://..."
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">Source Type</Label>
              <Select value={form.source_type} onValueChange={v => setForm(f => ({ ...f, source_type: (v ?? 'post_owner') as 'post_owner' | 'commenter' }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="post_owner" className="text-white">Post Owner</SelectItem>
                  <SelectItem value="commenter" className="text-white">Commenter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">Initial Notes</Label>
              <Textarea
                placeholder="Enter your initial observations..."
                value={form.initial_notes}
                onChange={e => setForm(f => ({ ...f, initial_notes: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 min-h-[80px]"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} className="bg-red-600 hover:bg-red-700">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Evidence Upload */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">
                Original Screenshot <span className="text-red-400">*</span>
              </Label>
              <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${form.screenshot ? 'border-green-500/50 bg-green-500/5' : 'border-slate-600 hover:border-red-500/50 hover:bg-red-500/5'}`}>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => setForm(f => ({ ...f, screenshot: e.target.files?.[0] ?? null }))} />
                {form.screenshot ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">{form.screenshot.name}</span>
                  </div>
                ) : (
                  <div className="text-center text-slate-500">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click to upload screenshot</p>
                    <p className="text-xs mt-1">PNG, JPG, WEBP up to 10MB</p>
                  </div>
                )}
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">Additional Files <span className="text-slate-500">(optional)</span></Label>
              <label className="flex items-center gap-3 p-3 border border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-slate-500 transition-colors">
                <input type="file" multiple className="hidden"
                  onChange={e => setForm(f => ({ ...f, additional_files: Array.from(e.target.files ?? []) }))} />
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-500">
                  {form.additional_files.length > 0 ? `${form.additional_files.length} file(s) selected` : 'Upload videos, documents, extra screenshots'}
                </span>
              </label>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} className="text-slate-400">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={runAIEvaluation}
                disabled={evaluating}
                className="bg-red-600 hover:bg-red-700"
              >
                {evaluating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Evaluating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Run AI Evaluation</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: AI Review */}
        {step === 3 && aiResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-amber-400 text-xs">Review AI suggestions carefully. Human confirmation required before saving.</p>
            </div>

            {/* Severity */}
            <div className={`p-4 rounded-xl border ${severityConfig[aiResult.severity].bg} ${severityConfig[aiResult.severity].border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 text-sm font-medium">Severity Assessment</span>
                <Badge className={`${severityConfig[aiResult.severity].bg} ${severityConfig[aiResult.severity].text} border ${severityConfig[aiResult.severity].border}`}>
                  {aiResult.severity}
                </Badge>
              </div>
              <p className="text-slate-400 text-xs">{aiResult.severity_reasoning}</p>
            </div>

            {/* Summary */}
            <div className="space-y-1">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">AI Summary</p>
              <p className="text-slate-200 text-sm bg-slate-800 rounded-lg p-3">{aiResult.summary}</p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Category</p>
                <p className="text-white text-sm">{aiResult.claim_category}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Suggested Topic</p>
                <p className="text-white text-sm">{aiResult.suggested_topic}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Evidence Level</p>
                <p className="text-white text-sm">{aiResult.evidence_level}</p>
                <p className="text-slate-500 text-xs mt-0.5">{aiResult.evidence_reasoning}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Influence Level</p>
                <p className="text-white text-sm">Level {aiResult.influence_level} / 5</p>
              </div>
            </div>

            {/* Keywords */}
            {aiResult.keywords.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {aiResult.keywords.map(kw => (
                    <span key={kw} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {aiResult.duplicate_notes && (
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Duplicate / Similar Claims</p>
                <p className="text-slate-300 text-xs">{aiResult.duplicate_notes}</p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)} className="text-slate-400">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm & Save Case</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
