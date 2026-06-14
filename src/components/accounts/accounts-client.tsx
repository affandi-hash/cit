'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ExternalLink, Search, Users, CheckCircle2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

type VerificationStatus = 'publicly_sourced' | 'unverified' | 'verified'

interface Account {
  id: string
  name: string | null
  username: string | null
  profile_url: string | null
  followers: number | null
  following: number | null
  is_verified: boolean
  workplace: string | null
  company: string | null
  phone_number: string | null
  address: string | null
  notes: string | null
  name_status: VerificationStatus
  username_status: VerificationStatus
  workplace_status: VerificationStatus
  company_status: VerificationStatus
  phone_status: VerificationStatus
  address_status: VerificationStatus
  created_at: string
  updated_at: string
  account_types: { id: string; name: string } | null
}

interface Props {
  initialAccounts: Account[]
  accountTypes: { id: string; name: string }[]
  platforms: { id: string; name: string }[]
}

const EMPTY_FORM = {
  name: '',
  username: '',
  profile_url: '',
  account_type_id: '',
  followers: '',
  following: '',
  is_verified: false,
  workplace: '',
  company: '',
  phone_number: '',
  address: '',
  notes: '',
  name_status: 'unverified' as VerificationStatus,
  username_status: 'unverified' as VerificationStatus,
  workplace_status: 'unverified' as VerificationStatus,
  company_status: 'unverified' as VerificationStatus,
  phone_status: 'unverified' as VerificationStatus,
  address_status: 'unverified' as VerificationStatus,
}

const STATUS_COLORS: Record<VerificationStatus, string> = {
  verified: 'text-green-400',
  publicly_sourced: 'text-blue-400',
  unverified: 'text-slate-500',
}

const STATUS_LABELS: Record<VerificationStatus, string> = {
  verified: 'Verified',
  publicly_sourced: 'Publicly Sourced',
  unverified: 'Unverified',
}

export function AccountsClient({ initialAccounts, accountTypes }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [accounts, setAccounts] = useState(initialAccounts)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(acc: Account) {
    setEditTarget(acc)
    setForm({
      name: acc.name ?? '',
      username: acc.username ?? '',
      profile_url: acc.profile_url ?? '',
      account_type_id: acc.account_types?.id ?? '',
      followers: acc.followers?.toString() ?? '',
      following: acc.following?.toString() ?? '',
      is_verified: acc.is_verified,
      workplace: acc.workplace ?? '',
      company: acc.company ?? '',
      phone_number: acc.phone_number ?? '',
      address: acc.address ?? '',
      notes: acc.notes ?? '',
      name_status: acc.name_status,
      username_status: acc.username_status,
      workplace_status: acc.workplace_status,
      company_status: acc.company_status,
      phone_status: acc.phone_status,
      address_status: acc.address_status,
    })
    setModalOpen(true)
  }

  function set(field: string, value: string | boolean | null) {
    setForm(p => ({ ...p, [field]: value }))
  }

  async function save() {
    if (!form.name && !form.username) {
      toast.error('Name or username is required')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name || null,
      username: form.username || null,
      profile_url: form.profile_url || null,
      account_type_id: form.account_type_id || null,
      followers: form.followers ? Number(form.followers) : null,
      following: form.following ? Number(form.following) : null,
      is_verified: form.is_verified,
      workplace: form.workplace || null,
      company: form.company || null,
      phone_number: form.phone_number || null,
      address: form.address || null,
      notes: form.notes || null,
      name_status: form.name_status,
      username_status: form.username_status,
      workplace_status: form.workplace_status,
      company_status: form.company_status,
      phone_status: form.phone_status,
      address_status: form.address_status,
    }

    if (editTarget) {
      const { error } = await supabase.from('accounts').update(payload).eq('id', editTarget.id)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Account updated')
    } else {
      const { error } = await supabase.from('accounts').insert(payload)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Account created')
    }
    setModalOpen(false)
    router.refresh()
  }

  async function deleteAccount(acc: Account) {
    if (!confirm(`Delete account "${acc.name ?? acc.username}"? This cannot be undone.`)) return
    setDeletingId(acc.id)
    const { error } = await supabase.from('accounts').delete().eq('id', acc.id)
    setDeletingId(null)
    if (error) { toast.error(error.message); return }
    setAccounts(p => p.filter(a => a.id !== acc.id))
    toast.success('Account deleted')
  }

  const filtered = accounts.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.name?.toLowerCase().includes(q) ||
      a.username?.toLowerCase().includes(q) ||
      a.company?.toLowerCase().includes(q) ||
      a.workplace?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-slate-500 text-sm mt-0.5">{filtered.length} perpetrator account{filtered.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <Button onClick={openAdd} style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)' }} className="text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Account
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search accounts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-600">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">No accounts yet. Add the first perpetrator account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(acc => (
            <div key={acc.id} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-3 hover:border-slate-600 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                  style={{ background: 'linear-gradient(135deg, #334155, #475569)' }}>
                  {(acc.name ?? acc.username ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold truncate">{acc.name ?? '—'}</p>
                    {acc.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </div>
                  {acc.username && <p className="text-slate-400 text-sm">@{acc.username}</p>}
                  {acc.account_types?.name && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
                      {acc.account_types.name}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {acc.profile_url && (
                    <a href={acc.profile_url} target="_blank" rel="noopener noreferrer">
                      <button className="p-1.5 rounded-lg text-slate-600 hover:text-teal-400 hover:bg-teal-400/10 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </a>
                  )}
                  <button onClick={() => openEdit(acc)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteAccount(acc)} disabled={deletingId === acc.id}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {(acc.followers != null || acc.following != null) && (
                <div className="flex gap-4 text-sm">
                  {acc.followers != null && (
                    <div><span className="text-white font-semibold">{acc.followers.toLocaleString()}</span> <span className="text-slate-500">followers</span></div>
                  )}
                  {acc.following != null && (
                    <div><span className="text-white font-semibold">{acc.following.toLocaleString()}</span> <span className="text-slate-500">following</span></div>
                  )}
                </div>
              )}

              {(acc.workplace || acc.company) && (
                <div className="text-xs text-slate-400 space-y-0.5">
                  {acc.workplace && <p>🏢 {acc.workplace}</p>}
                  {acc.company && <p>💼 {acc.company}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={v => { if (!v) setModalOpen(false) }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white" style={{ width: '90vw', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle className="text-white">
              {editTarget ? `Edit — ${editTarget.name ?? editTarget.username}` : 'Add Account'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Identity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Full Name</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Doc Krum" className="bg-slate-800 border-slate-700 text-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Username / Handle</Label>
                <Input value={form.username} onChange={e => set('username', e.target.value)}
                  placeholder="e.g. doc_krum" className="bg-slate-800 border-slate-700 text-white text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Account Type</Label>
                <Select value={form.account_type_id} onValueChange={v => set('account_type_id', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue placeholder="Select type...">
                      {accountTypes.find(t => t.id === form.account_type_id)?.name ?? 'Select type...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="" className="text-slate-500">— None —</SelectItem>
                    {accountTypes.map(t => <SelectItem key={t.id} value={t.id} className="text-white">{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Profile URL</Label>
                <Input value={form.profile_url} onChange={e => set('profile_url', e.target.value)}
                  placeholder="https://facebook.com/..." className="bg-slate-800 border-slate-700 text-white text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Followers</Label>
                <Input type="number" min={0} value={form.followers} onChange={e => set('followers', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Following</Label>
                <Input type="number" min={0} value={form.following} onChange={e => set('following', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Verified Account?</Label>
                <Select value={form.is_verified ? 'yes' : 'no'} onValueChange={v => set('is_verified', v === 'yes')}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="no" className="text-white">No</SelectItem>
                    <SelectItem value="yes" className="text-white">Yes (Blue tick)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Intel fields */}
            <div className="border-t border-slate-700 pt-3">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-3">Intelligence / OSINT</p>
              <div className="space-y-3">
                {([
                  { field: 'workplace', statusField: 'workplace_status', label: 'Workplace' },
                  { field: 'company', statusField: 'company_status', label: 'Company' },
                  { field: 'phone_number', statusField: 'phone_status', label: 'Phone Number' },
                  { field: 'address', statusField: 'address_status', label: 'Address' },
                ] as { field: keyof typeof form; statusField: keyof typeof form; label: string }[]).map(({ field, statusField, label }) => (
                  <div key={field} className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-slate-400 text-xs">{label}</Label>
                      <Input value={form[field] as string} onChange={e => set(field, e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 text-xs">Status</Label>
                      <Select value={form[statusField] as string} onValueChange={v => set(statusField, v)}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-sm" style={{ color: STATUS_COLORS[form[statusField] as VerificationStatus] }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {(Object.keys(STATUS_LABELS) as VerificationStatus[]).map(s => (
                            <SelectItem key={s} value={s} className={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={3} placeholder="Any additional intelligence notes..."
                className="bg-slate-800 border-slate-700 text-white text-sm resize-none" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">Cancel</Button>
            <Button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)' }} className="text-white">
              {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
