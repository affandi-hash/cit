'use client'

import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ExternalLink, BookmarkPlus, XCircle, Copy, Camera,
  Scale, Loader2, Globe, Tag, Zap, Eye, CheckCircle2, ChevronDown
} from 'lucide-react'
import { format } from 'date-fns'
import type { Lead, LeadStatus } from '@/types'

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new',              label: 'New' },
  { value: 'opened',           label: 'Opened' },
  { value: 'useful',           label: 'Useful' },
  { value: 'not_relevant',     label: 'Not Relevant' },
  { value: 'duplicate',        label: 'Duplicate' },
  { value: 'saved_to_case',    label: 'Saved to Case' },
  { value: 'needs_screenshot', label: 'Needs Screenshot' },
  { value: 'legal_review',     label: 'Legal Review' },
]

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-slate-500',
}

interface Props {
  lead: Lead
  onClose: () => void
  onUpdated: (lead: Lead) => void
  onConverted: (leadId: string, caseNumber: string) => void
}

export function LeadDetailModal({ lead, onClose, onUpdated, onConverted }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [status, setStatus] = useState<LeadStatus>(lead.status)

  async function saveStatus(newStatus: LeadStatus) {
    setStatus(newStatus)
    setSaving(true)
    const { data, error } = await supabase
      .from('leads')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', lead.id)
      .select()
      .single()
    setSaving(false)
    if (error) { toast.error(error.message); return }
    onUpdated(data as Lead)
    toast.success('Status updated')
  }

  async function convertToCase() {
    setConverting(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Conversion failed')
      onConverted(lead.id, data.case_number)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setConverting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="border-slate-700/50 text-white p-0 overflow-hidden"
        style={{ background: '#0D1B2A', maxWidth: '680px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-teal-400 text-xs">{lead.lead_number}</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[lead.ai_priority] ?? 'bg-slate-500'}`} />
                <span className="text-xs text-slate-400 capitalize">{lead.ai_priority} priority</span>
              </div>
              {saving && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
            </div>
            <h2 className="text-white font-semibold text-base leading-snug line-clamp-2">
              {lead.title ?? 'Untitled Lead'}
            </h2>
          </div>

          {/* Status selector */}
          <div className="relative shrink-0">
            <select
              value={status}
              onChange={e => saveStatus(e.target.value as LeadStatus)}
              className="appearance-none pl-3 pr-7 py-1.5 bg-slate-700/60 border border-white/[0.08] rounded-lg text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Snippet */}
          {lead.snippet && (
            <div className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
              <p className="text-slate-300 text-sm leading-relaxed">&ldquo;{lead.snippet}&rdquo;</p>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <Field icon={<Globe className="w-3.5 h-3.5" />} label="Platform" value={lead.platform} />
            <Field icon={<Eye className="w-3.5 h-3.5" />} label="Author / Source" value={lead.author} />
            <Field icon={<Tag className="w-3.5 h-3.5" />} label="Matched Entity" value={lead.matched_entity} />
            <Field icon={<Tag className="w-3.5 h-3.5" />} label="Matched Keyword" value={lead.matched_keyword} />
            <Field icon={<Zap className="w-3.5 h-3.5" />} label="Detected Narrative" value={lead.narrative} />
            <Field icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Published Date" value={lead.published_date} />
          </div>

          {/* URL */}
          {lead.url && (
            <div>
              <p className="text-slate-500 text-xs mb-1.5">Source URL</p>
              <a
                href={lead.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-teal-400 text-xs hover:text-teal-300 transition-colors break-all"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                {lead.url}
              </a>
            </div>
          )}

          {/* AI Notes */}
          {lead.ai_notes && (
            <div>
              <p className="text-slate-500 text-xs mb-1.5">AI Notes</p>
              <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/40 rounded-lg px-4 py-3 border border-white/[0.05]">
                {lead.ai_notes}
              </p>
            </div>
          )}

          {/* Date info */}
          <p className="text-slate-600 text-xs">
            Found {format(new Date(lead.date_found), 'dd MMM yyyy, HH:mm')}
            {lead.converted_case_id && (
              <span className="ml-2 text-teal-400">· Converted to case</span>
            )}
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveStatus('not_relevant')}
              className="border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 gap-1.5 text-xs"
            >
              <XCircle className="w-3.5 h-3.5" />
              Not Relevant
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveStatus('duplicate')}
              className="border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 gap-1.5 text-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveStatus('needs_screenshot')}
              className="border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 gap-1.5 text-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              Screenshot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveStatus('legal_review')}
              className="border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 gap-1.5 text-xs"
            >
              <Scale className="w-3.5 h-3.5" />
              Legal
            </Button>
          </div>

          <Button
            onClick={convertToCase}
            disabled={converting || lead.status === 'saved_to_case'}
            className="gap-2 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)' }}
          >
            {converting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <BookmarkPlus className="w-4 h-4" />
            }
            {lead.status === 'saved_to_case' ? 'Already Saved' : 'Save to CIT Case'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className="text-white text-sm">{value ?? '—'}</p>
    </div>
  )
}
