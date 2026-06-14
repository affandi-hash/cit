'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Edit3, ChevronDown, ChevronRight, Download, Upload, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface KeywordGroup {
  id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  sort_order: number
}

interface Keyword {
  id: string
  group_id: string | null
  keyword: string
  severity_score: number
  color_tag: string
  reputation_impact: string
  is_active: boolean
  is_legal_flag: boolean
}

interface Props {
  initialGroups: KeywordGroup[]
  initialKeywords: Keyword[]
}

const COLOR_OPTIONS = ['RED', 'YELLOW', 'BLUE', 'GREY']
const IMPACT_OPTIONS = ['Critical', 'High', 'Medium', 'Low']

const COLOR_DOT: Record<string, string> = {
  RED: 'bg-red-500', YELLOW: 'bg-yellow-500', BLUE: 'bg-blue-500', GREY: 'bg-slate-500'
}
const COLOR_TEXT: Record<string, string> = {
  RED: 'text-red-400', YELLOW: 'text-yellow-400', BLUE: 'text-blue-400', GREY: 'text-slate-400'
}

export function KeywordLibrary({ initialGroups, initialKeywords }: Props) {
  const supabase = createClient()
  const [groups, setGroups] = useState<KeywordGroup[]>(initialGroups)
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null)

  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('BLUE')
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null)
  const [newKw, setNewKw] = useState({ keyword: '', severity_score: 50, color_tag: 'YELLOW', reputation_impact: 'Medium', is_legal_flag: false })

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function addGroup() {
    if (!newGroupName.trim()) return
    const { data, error } = await supabase.from('keyword_groups').insert({
      name: newGroupName.trim(), color: newGroupColor, sort_order: groups.length + 1
    }).select().single()
    if (error) { toast.error(error.message); return }
    setGroups(prev => [...prev, data as KeywordGroup])
    setNewGroupName('')
    toast.success('Group created')
  }

  async function deleteGroup(id: string) {
    const { error } = await supabase.from('keyword_groups').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setGroups(prev => prev.filter(g => g.id !== id))
    setKeywords(prev => prev.filter(k => k.group_id !== id))
    toast.success('Group deleted')
  }

  async function addKeyword(groupId: string) {
    if (!newKw.keyword.trim()) return
    const { data, error } = await supabase.from('keywords').insert({
      group_id: groupId,
      keyword: newKw.keyword.trim().toLowerCase(),
      severity_score: newKw.severity_score,
      color_tag: newKw.color_tag,
      reputation_impact: newKw.reputation_impact,
      is_legal_flag: newKw.is_legal_flag,
    }).select().single()
    if (error) { toast.error(error.message); return }
    setKeywords(prev => [...prev, data as Keyword])
    setNewKw({ keyword: '', severity_score: 50, color_tag: 'YELLOW', reputation_impact: 'Medium', is_legal_flag: false })
    setAddingToGroup(null)
    toast.success('Keyword added')
  }

  async function toggleKeyword(id: string, current: boolean) {
    const { error } = await supabase.from('keywords').update({ is_active: !current }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setKeywords(prev => prev.map(k => k.id === id ? { ...k, is_active: !current } : k))
  }

  async function deleteKeyword(id: string) {
    const { error } = await supabase.from('keywords').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setKeywords(prev => prev.filter(k => k.id !== id))
    toast.success('Deleted')
  }

  async function updateKeyword(id: string, field: string, value: string | number | boolean) {
    const { error } = await supabase.from('keywords').update({ [field]: value }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setKeywords(prev => prev.map(k => k.id === id ? { ...k, [field]: value } : k))
  }

  function exportCSV() {
    const rows = [['Keyword', 'Group', 'Severity Score', 'Color', 'Reputation Impact', 'Legal Flag', 'Active']]
    keywords.forEach(k => {
      const group = groups.find(g => g.id === k.group_id)
      rows.push([k.keyword, group?.name ?? 'Ungrouped', String(k.severity_score), k.color_tag, k.reputation_impact, k.is_legal_flag ? 'Yes' : 'No', k.is_active ? 'Yes' : 'No'])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'keyword_library.csv'; a.click()
  }

  const ungrouped = keywords.filter(k => !k.group_id)
  const totalActive = keywords.filter(k => k.is_active).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{keywords.length} keywords · {totalActive} active · {groups.length} groups</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="border-slate-700 text-slate-400 hover:text-white h-8 text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Add Group */}
      <div className="flex gap-2">
        <Input
          placeholder="New group name..."
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addGroup()}
          className="bg-slate-800 border-slate-700 text-white text-sm h-9 flex-1"
        />
        <Select value={newGroupColor} onValueChange={setNewGroupColor}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {COLOR_OPTIONS.map(c => (
              <SelectItem key={c} value={c} className="text-white">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', COLOR_DOT[c])} />
                  {c}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={addGroup} size="sm" className="bg-blue-600 hover:bg-blue-700 h-9 gap-1.5">
          <Plus className="w-4 h-4" /> Add Group
        </Button>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {groups.map(group => {
          const groupKeywords = keywords.filter(k => k.group_id === group.id)
          const isExpanded = expandedGroups.has(group.id)
          return (
            <div key={group.id} className="border border-slate-700/60 rounded-xl overflow-hidden">
              {/* Group header */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 cursor-pointer hover:bg-slate-800"
                onClick={() => toggleGroup(group.id)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', COLOR_DOT[group.color] ?? 'bg-slate-500')} />
                <span className="text-white font-medium text-sm flex-1">{group.name}</span>
                <span className="text-slate-500 text-xs">{groupKeywords.length} keywords</span>
                <button
                  onClick={e => { e.stopPropagation(); setAddingToGroup(addingToGroup === group.id ? null : group.id) }}
                  className="p-1 text-slate-500 hover:text-blue-400 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteGroup(group.id) }}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add keyword form */}
              {addingToGroup === group.id && (
                <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-700/40 grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Input
                    placeholder="keyword..."
                    value={newKw.keyword}
                    onChange={e => setNewKw(p => ({ ...p, keyword: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white text-xs h-8"
                  />
                  <Input
                    type="number" min={0} max={100}
                    placeholder="Score 0-100"
                    value={newKw.severity_score}
                    onChange={e => setNewKw(p => ({ ...p, severity_score: Number(e.target.value) }))}
                    className="bg-slate-800 border-slate-700 text-white text-xs h-8"
                  />
                  <Select value={newKw.color_tag} onValueChange={v => setNewKw(p => ({ ...p, color_tag: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {COLOR_OPTIONS.map(c => <SelectItem key={c} value={c} className="text-white text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newKw.reputation_impact} onValueChange={v => setNewKw(p => ({ ...p, reputation_impact: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {IMPACT_OPTIONS.map(i => <SelectItem key={i} value={i} className="text-white text-xs">{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => addKeyword(group.id)} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs flex-1">Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingToGroup(null)} className="text-slate-500 h-8 text-xs">✕</Button>
                  </div>
                </div>
              )}

              {/* Keywords list */}
              {isExpanded && (
                <div className="divide-y divide-slate-800/50">
                  {groupKeywords.length === 0 ? (
                    <p className="text-slate-600 text-xs px-4 py-3">No keywords yet. Click + to add.</p>
                  ) : (
                    groupKeywords.map(kw => (
                      <div key={kw.id} className={cn('flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/20 transition-colors', !kw.is_active && 'opacity-40')}>
                        <div className={cn('w-2 h-2 rounded-full shrink-0', COLOR_DOT[kw.color_tag] ?? 'bg-slate-500')} />
                        <span className={cn('text-sm flex-1 font-mono', COLOR_TEXT[kw.color_tag] ?? 'text-slate-300')}>{kw.keyword}</span>
                        {kw.is_legal_flag && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/15 text-red-400 text-[10px] rounded border border-red-500/25">
                            <Shield className="w-2.5 h-2.5" /> Legal
                          </span>
                        )}
                        <span className="text-slate-500 text-xs tabular-nums w-8 text-center">{kw.severity_score}</span>
                        <span className="text-slate-600 text-xs w-16">{kw.reputation_impact}</span>
                        <button onClick={() => toggleKeyword(kw.id, kw.is_active)}
                          className={cn('text-xs px-2 py-0.5 rounded transition-colors', kw.is_active ? 'bg-green-500/15 text-green-400' : 'bg-slate-700/40 text-slate-600')}>
                          {kw.is_active ? 'Active' : 'Off'}
                        </button>
                        <button onClick={() => deleteKeyword(kw.id)} className="text-slate-600 hover:text-red-400 p-1 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Ungrouped */}
        {ungrouped.length > 0 && (
          <div className="border border-slate-700/40 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/30 cursor-pointer" onClick={() => toggleGroup('ungrouped')}>
              {expandedGroups.has('ungrouped') ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              <span className="text-slate-500 text-sm flex-1">Ungrouped</span>
              <span className="text-slate-600 text-xs">{ungrouped.length} keywords</span>
            </div>
            {expandedGroups.has('ungrouped') && (
              <div className="divide-y divide-slate-800/50">
                {ungrouped.map(kw => (
                  <div key={kw.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/20">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', COLOR_DOT[kw.color_tag] ?? 'bg-slate-500')} />
                    <span className="text-sm text-slate-300 flex-1 font-mono">{kw.keyword}</span>
                    <span className="text-slate-500 text-xs tabular-nums">{kw.severity_score}</span>
                    <button onClick={() => deleteKeyword(kw.id)} className="text-slate-600 hover:text-red-400 p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
