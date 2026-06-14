'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { Platform, Topic } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  platforms: Platform[]
  topics: Topic[]
  caseData: {
    id: string
    case_number: string
    url: string | null
    platform_id?: string | null
    topic_id?: string | null
    account_id?: string | null
    status: string
    source_type: string
    date_found: string
    initial_notes?: string | null
    severity_color?: string | null
    platforms?: { id: string; name: string } | null
    topics?: { id: string; name: string } | null
    accounts?: { id: string; name: string | null; username: string | null } | null
    post_owner_name?: string | null
    post_datetime?: string | null
    emoji_count?: number | null
    post_comments?: number | null
    post_shares?: number | null
  }
}

const STATUS_OPTIONS = ['new', 'under_review', 'verified', 'dismissed', 'escalated', 'closed']
const SOURCE_TYPES = ['post_owner', 'third_party', 'screenshot', 'news_article', 'video', 'other']
const SEVERITY_OPTIONS = ['RED', 'YELLOW', 'BLUE', 'GREY']

export function EditCaseModal({ open, onClose, onSaved, platforms, topics, caseData }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [accountList, setAccountList] = useState<{ id: string; name: string | null; username: string | null }[]>([])

  useEffect(() => {
    supabase.from('accounts').select('id, name, username').order('name').then(({ data }) => setAccountList(data ?? []))
  }, [])

  const [form, setForm] = useState({
    url: caseData.url ?? '',
    platform_id: caseData.platforms?.id ?? caseData.platform_id ?? '',
    topic_id: caseData.topics?.id ?? caseData.topic_id ?? '',
    account_id: caseData.accounts?.id ?? caseData.account_id ?? '',
    status: caseData.status,
    source_type: caseData.source_type,
    date_found: caseData.date_found?.split('T')[0] ?? '',
    severity_color: caseData.severity_color ?? '',
    initial_notes: caseData.initial_notes ?? '',
    post_owner_name: caseData.post_owner_name ?? '',
    post_datetime: caseData.post_datetime ? caseData.post_datetime.slice(0, 16) : '',
    emoji_count: caseData.emoji_count ?? 0,
    post_comments: caseData.post_comments ?? 0,
    post_shares: caseData.post_shares ?? 0,
  })

  function set(field: string, value: string | null) {
    setForm(p => ({ ...p, [field]: value }))
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('cases').update({
      url: form.url || null,
      platform_id: form.platform_id || null,
      topic_id: form.topic_id || null,
      account_id: form.account_id || null,
      status: form.status,
      source_type: form.source_type,
      date_found: form.date_found,
      severity_color: form.severity_color || null,
      initial_notes: form.initial_notes || null,
      post_owner_name: form.post_owner_name || null,
      post_datetime: form.post_datetime || null,
      emoji_count: Number(form.emoji_count) || 0,
      post_comments: Number(form.post_comments) || 0,
      post_shares: Number(form.post_shares) || 0,
    }).eq('id', caseData.id)

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Case updated')
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white" style={{ maxWidth: '720px', width: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <span className="font-mono text-red-400 text-sm">{caseData.case_number}</span>
            <span className="text-slate-400 font-normal">— Edit Case</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Source URL</Label>
            <Input value={form.url} onChange={e => set('url', e.target.value)}
              placeholder="https://..." className="bg-slate-800 border-slate-700 text-white text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Platform</Label>
              <Select value={form.platform_id} onValueChange={v => set('platform_id', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
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
              <Label className="text-slate-400 text-xs">Topic</Label>
              <Select value={form.topic_id} onValueChange={v => set('topic_id', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                  <SelectValue placeholder="Select...">
                    {topics.find(t => t.id === form.topic_id)?.name ?? 'Select...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {topics.map(t => <SelectItem key={t.id} value={t.id} className="text-white">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Account (Perpetrator)</Label>
            <Select value={form.account_id} onValueChange={v => set('account_id', v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                <SelectValue placeholder="Select account...">
                  {accountList.find(a => a.id === form.account_id)
                    ? `${accountList.find(a => a.id === form.account_id)?.name ?? ''}${accountList.find(a => a.id === form.account_id)?.username ? ` (@${accountList.find(a => a.id === form.account_id)?.username})` : ''}`
                    : 'Select account...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="" className="text-slate-500">— None —</SelectItem>
                {accountList.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-white">
                    {a.name ?? a.username ?? a.id}{a.username ? ` (@${a.username})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-white capitalize">{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Severity</Label>
              <Select value={form.severity_color} onValueChange={v => set('severity_color', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                  <SelectValue placeholder="Unset" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {SEVERITY_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Source Type</Label>
              <Select value={form.source_type} onValueChange={v => set('source_type', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {SOURCE_TYPES.map(s => <SelectItem key={s} value={s} className="text-white capitalize">{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Date Found</Label>
              <Input type="date" value={form.date_found} onChange={e => set('date_found', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Investigator Notes</Label>
            <Textarea value={form.initial_notes} onChange={e => set('initial_notes', e.target.value)}
              rows={3} placeholder="Notes..."
              className="bg-slate-800 border-slate-700 text-white text-sm resize-none" />
          </div>

          <div className="border-t border-slate-700 pt-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-3">Post Metadata</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Post Author</Label>
                  <Input value={form.post_owner_name} onChange={e => set('post_owner_name', e.target.value)}
                    placeholder="e.g. Asraff Jeffery"
                    className="bg-slate-800 border-slate-700 text-white text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Post Date &amp; Time</Label>
                  <Input type="datetime-local" value={form.post_datetime} onChange={e => set('post_datetime', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Reactions</Label>
                  <Input type="number" min={0} value={form.emoji_count} onChange={e => set('emoji_count', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Comments</Label>
                  <Input type="number" min={0} value={form.post_comments} onChange={e => set('post_comments', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Shares</Label>
                  <Input type="number" min={0} value={form.post_shares} onChange={e => set('post_shares', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
