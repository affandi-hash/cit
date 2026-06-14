'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, ChevronDown, ChevronRight, Download, Shield } from 'lucide-react'
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
  keyword_type: string
  severity_score: number
  seriousness_score: number
  reputation_score: number
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
const KEYWORD_TYPES = ['Allegation', 'Reputation Attack', 'Financial', 'Legal', 'Business Dispute', 'Entity', 'Platform / Source', 'Neutral Context', 'Custom']

const COLOR_DOT: Record<string, string> = {
  RED: 'bg-red-500', YELLOW: 'bg-yellow-500', BLUE: 'bg-blue-500', GREY: 'bg-slate-500', ORANGE: 'bg-orange-500'
}
const COLOR_TEXT: Record<string, string> = {
  RED: 'text-red-400', YELLOW: 'text-yellow-400', BLUE: 'text-blue-400', GREY: 'text-slate-400', ORANGE: 'text-orange-400'
}
const TYPE_BADGE: Record<string, string> = {
  'Allegation': 'bg-red-500/15 text-red-400 border-red-500/25',
  'Reputation Attack': 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'Financial': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  'Legal': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Business Dispute': 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  'Entity': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'Platform / Source': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  'Neutral Context': 'bg-slate-600/20 text-slate-400 border-slate-600/30',
  'Custom': 'bg-slate-700/30 text-slate-400 border-slate-700/40',
}

const BLANK_KW = { keyword: '', keyword_type: 'Custom', severity_score: 50, seriousness_score: 0, reputation_score: 0, color_tag: 'YELLOW', reputation_impact: 'Medium', is_legal_flag: false }

export function KeywordLibrary({ initialGroups, initialKeywords }: Props) {
  const supabase = createClient()
  const [groups, setGroups] = useState<KeywordGroup[]>(initialGroups)
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('BLUE')
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null)
  const [newKw, setNewKw] = useState(BLANK_KW)

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
    const isEntity = newKw.keyword_type === 'Entity'
    const { data, error } = await supabase.from('keywords').insert({
      group_id: groupId,
      keyword: newKw.keyword.trim().toLowerCase(),
      keyword_type: newKw.keyword_type,
      severity_score: isEntity ? 0 : newKw.severity_score,
      seriousness_score: ['Allegation', 'Legal', 'Financial', 'Business Dispute'].includes(newKw.keyword_type) ? newKw.seriousness_score : 0,
      reputation_score: newKw.keyword_type === 'Reputation Attack' ? newKw.reputation_score : 0,
      color_tag: isEntity ? 'GREY' : newKw.color_tag,
      reputation_impact: newKw.reputation_impact,
      is_legal_flag: isEntity ? false : newKw.is_legal_flag,
    }).select().single()
    if (error) { toast.error(error.message); return }
    setKeywords(prev => [...prev, data as Keyword])
    setNewKw(BLANK_KW)
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

  function exportCSV() {
    const rows = [['Keyword', 'Type', 'Group', 'Severity', 'Seriousness', 'Reputation', 'Color', 'Impact', 'Legal Flag', 'Active']]
    keywords.forEach(k => {
      const group = groups.find(g => g.id === k.group_id)
      rows.push([k.keyword, k.keyword_type ?? '', group?.name ?? 'Ungrouped', String(k.severity_score), String(k.seriousness_score ?? 0), String(k.reputation_score ?? 0), k.color_tag, k.reputation_impact, k.is_legal_flag ? 'Yes' : 'No', k.is_active ? 'Yes' : 'No'])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'keyword_library.csv'; a.click()
  }

  const ungrouped = keywords.filter(k => !k.group_id)
  const totalActive = keywords.filter(k => k.is_active).length
  const isEntity = newKw.keyword_type === 'Entity'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{keywords.length} keywords · {totalActive} active · {groups.length} groups</p>
        <Button size="sm" variant="outline" onClick={exportCSV} className="border-slate-700 text-slate-400 hover:text-white h-8 text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
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
        <Select value={newGroupColor} onValueChange={v => v && setNewGroupColor(v)}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {COLOR_OPTIONS.map(c => (
              <SelectItem key={c} value={c} className="text-white">
                <div className="flex items-center gap-2"><div className={cn('w-2 h-2 rounded-full', COLOR_DOT[c])} />{c}</div>
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
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 cursor-pointer hover:bg-slate-800" onClick={() => toggleGroup(group.id)}>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', COLOR_DOT[group.color] ?? 'bg-slate-500')} />
                <span className="text-white font-medium text-sm flex-1">{group.name}</span>
                <span className="text-slate-500 text-xs">{groupKeywords.length} keywords</span>
                <button onClick={e => { e.stopPropagation(); setAddingToGroup(addingToGroup === group.id ? null : group.id) }}
                  className="p-1 text-slate-500 hover:text-blue-400 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteGroup(group.id) }}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add keyword form */}
              {addingToGroup === group.id && (
                <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-700/40 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="keyword..."
                      value={newKw.keyword}
                      onChange={e => setNewKw(p => ({ ...p, keyword: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addKeyword(group.id)}
                      className="bg-slate-800 border-slate-700 text-white text-xs h-8"
                    />
                    <Select value={newKw.keyword_type} onValueChange={v => v && setNewKw(p => ({ ...p, keyword_type: v }))}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {KEYWORD_TYPES.map(t => <SelectItem key={t} value={t} className="text-white text-xs">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={newKw.reputation_impact} onValueChange={v => v && setNewKw(p => ({ ...p, reputation_impact: v }))}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {IMPACT_OPTIONS.map(i => <SelectItem key={i} value={i} className="text-white text-xs">{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!isEntity && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Input type="number" min={0} max={100} placeholder="Severity"
                        value={newKw.severity_score}
                        onChange={e => setNewKw(p => ({ ...p, severity_score: Number(e.target.value) }))}
                        className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
                      <Input type="number" min={0} max={100} placeholder="Seriousness"
                        value={newKw.seriousness_score}
                        onChange={e => setNewKw(p => ({ ...p, seriousness_score: Number(e.target.value) }))}
                        className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
                      <Input type="number" min={0} max={100} placeholder="Rep. Score"
                        value={newKw.reputation_score}
                        onChange={e => setNewKw(p => ({ ...p, reputation_score: Number(e.target.value) }))}
                        className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
                      <Select value={newKw.color_tag} onValueChange={v => v && setNewKw(p => ({ ...p, color_tag: v }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {COLOR_OPTIONS.map(c => <SelectItem key={c} value={c} className="text-white text-xs">{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    {!isEntity ? (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={newKw.is_legal_flag}
                          onChange={e => setNewKw(p => ({ ...p, is_legal_flag: e.target.checked }))}
                          className="accent-red-500 w-3.5 h-3.5" />
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-red-400" /> Legal Flag
                        </span>
                      </label>
                    ) : (
                      <p className="text-xs text-slate-600 italic">Entity keywords have seriousness score 0 and never trigger legal review alone.</p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => addKeyword(group.id)} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs px-4">Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingToGroup(null)} className="text-slate-500 h-8 text-xs">✕</Button>
                    </div>
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
                      <div key={kw.id} className={cn('flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800/20 transition-colors', !kw.is_active && 'opacity-40')}>
                        <div className={cn('w-2 h-2 rounded-full shrink-0', COLOR_DOT[kw.color_tag] ?? 'bg-slate-500')} />
                        <span className={cn('text-sm flex-1 font-mono', COLOR_TEXT[kw.color_tag] ?? 'text-slate-300')}>{kw.keyword}</span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', TYPE_BADGE[kw.keyword_type] ?? TYPE_BADGE['Custom'])}>
                          {kw.keyword_type ?? 'Custom'}
                        </span>
                        {kw.is_legal_flag && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/15 text-red-400 text-[10px] rounded border border-red-500/25">
                            <Shield className="w-2.5 h-2.5" /> Legal
                          </span>
                        )}
                        <span className="text-slate-500 text-xs tabular-nums w-8 text-right">{kw.severity_score}</span>
                        <span className="text-slate-600 text-xs w-14 text-right">{kw.reputation_impact}</span>
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
                  <div key={kw.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800/20">
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
