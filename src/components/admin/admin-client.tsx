'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Save, Settings, Tag, Globe, Shield, Users, Sparkles, BarChart3, Edit3, Radar } from 'lucide-react'
import { toast } from 'sonner'
import { KeywordLibrary } from './keyword-library'

interface AdminClientProps {
  platforms: Record<string, unknown>[]
  topics: Record<string, unknown>[]
  severityLevels: Record<string, unknown>[]
  accountTypes: Record<string, unknown>[]
  scoringFormulas: Record<string, unknown>[]
  aiPrompts: Record<string, unknown>[]
  users: Record<string, unknown>[]
  currentUserRole: 'super_admin' | 'admin'
  keywordGroups: Record<string, unknown>[]
  keywords: Record<string, unknown>[]
  leadEntities: Record<string, unknown>[]
}

export function AdminClient({
  platforms: initialPlatforms,
  topics: initialTopics,
  severityLevels: initialSeverity,
  accountTypes: initialAccountTypes,
  scoringFormulas: initialFormulas,
  aiPrompts: initialPrompts,
  users: initialUsers,
  currentUserRole,
  keywordGroups,
  keywords,
  leadEntities: initialLeadEntities,
}: AdminClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') ?? 'platforms'

  const [platforms, setPlatforms] = useState(initialPlatforms)
  const [topics, setTopics] = useState(initialTopics)
  const [accountTypes, setAccountTypes] = useState(initialAccountTypes)
  const [formulas, setFormulas] = useState(initialFormulas)
  const [aiPrompts, setAiPrompts] = useState(initialPrompts)
  const [users, setUsers] = useState(initialUsers)

  const [leadEntities, setLeadEntities] = useState(initialLeadEntities)
  const [newLeadEntity, setNewLeadEntity] = useState('')

  const [newPlatform, setNewPlatform] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [newAccountType, setNewAccountType] = useState('')
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [promptText, setPromptText] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function addItem(table: string, payload: Record<string, unknown>, setItems: React.Dispatch<React.SetStateAction<any[]>>) {
    const { data, error } = await supabase.from(table).insert(payload).select().single()
    if (error) { toast.error(error.message); return }
    setItems((prev: unknown[]) => [...prev, data])
    toast.success('Added successfully')
  }

  async function toggleActive(table: string, id: string, current: boolean, items: Record<string, unknown>[], setItems: (fn: (prev: Record<string, unknown>[]) => Record<string, unknown>[]) => void) {
    const { error } = await supabase.from(table).update({ is_active: !current }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: !current } : i))
  }

  async function deleteItem(table: string, id: string, setItems: (fn: (prev: Record<string, unknown>[]) => Record<string, unknown>[]) => void) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setItems(prev => prev.filter(i => i.id !== id))
    toast.success('Deleted')
  }

  async function savePrompt(id: string, systemPrompt: string) {
    const { error } = await supabase.from('ai_prompts').update({ system_prompt: systemPrompt, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setAiPrompts(prev => prev.map(p => p.id === id ? { ...p, system_prompt: systemPrompt } : p))
    setEditingPrompt(null)
    toast.success('Prompt saved')
  }

  async function updateUserRole(userId: string, role: string) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) { toast.error(error.message); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    toast.success('Role updated')
  }

  async function saveFormulaWeights(id: string, weightsJson: string) {
    try {
      const weights = JSON.parse(weightsJson)
      const { error } = await supabase.from('scoring_formulas').update({ weights, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      setFormulas(prev => prev.map(f => f.id === id ? { ...f, weights } : f))
      toast.success('Formula saved')
    } catch {
      toast.error('Invalid JSON')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Configure all platform settings. Nothing is hardcoded.</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-slate-800 border border-slate-700 flex-wrap h-auto gap-1 p-1 mb-6">
          {[
            { value: 'platforms', label: 'Platforms', icon: Globe },
            { value: 'topics', label: 'Topics', icon: Tag },
            { value: 'account-types', label: 'Account Types', icon: Users },
            { value: 'keywords', label: 'Keyword Library', icon: Shield },
            { value: 'scoring', label: 'Scoring', icon: BarChart3 },
            { value: 'ai-prompts', label: 'AI Prompts', icon: Sparkles },
            { value: 'users', label: 'Users', icon: Users },
            { value: 'lead-discovery', label: 'Lead Discovery', icon: Radar },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}
              className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700 text-xs px-3 py-1.5">
              <tab.icon className="w-3.5 h-3.5 mr-1.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* PLATFORMS */}
        <TabsContent value="platforms">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Input
                placeholder="New platform name..."
                value={newPlatform}
                onChange={e => setNewPlatform(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 max-w-xs"
                onKeyDown={e => e.key === 'Enter' && newPlatform && addItem('platforms', { name: newPlatform, sort_order: platforms.length + 1 }, setPlatforms)}
              />
              <Button
                onClick={() => { if (newPlatform) { addItem('platforms', { name: newPlatform, sort_order: platforms.length + 1 }, setPlatforms); setNewPlatform('') } }}
                className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {platforms.map(p => (
                <div key={p.id as string} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className={`text-sm ${p.is_active ? 'text-white' : 'text-slate-500 line-through'}`}>{p.name as string}</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={p.is_active as boolean}
                      onCheckedChange={() => toggleActive('platforms', p.id as string, p.is_active as boolean, platforms, setPlatforms)}
                    />
                    <button onClick={() => deleteItem('platforms', p.id as string, setPlatforms)}
                      className="text-slate-600 hover:text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TOPICS */}
        <TabsContent value="topics">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Input
                placeholder="New topic name..."
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 max-w-xs"
              />
              <Button
                onClick={() => { if (newTopic) { addItem('topics', { name: newTopic, sort_order: topics.length + 1 }, setTopics); setNewTopic('') } }}
                className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {topics.map(t => (
                <div key={t.id as string} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className={`text-sm ${t.is_active ? 'text-white' : 'text-slate-500 line-through'}`}>{t.name as string}</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={t.is_active as boolean}
                      onCheckedChange={() => toggleActive('topics', t.id as string, t.is_active as boolean, topics, setTopics)}
                    />
                    <button onClick={() => deleteItem('topics', t.id as string, setTopics)}
                      className="text-slate-600 hover:text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ACCOUNT TYPES */}
        <TabsContent value="account-types">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Input
                placeholder="New account type..."
                value={newAccountType}
                onChange={e => setNewAccountType(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 max-w-xs"
              />
              <Button
                onClick={() => { if (newAccountType) { addItem('account_types', { name: newAccountType, sort_order: accountTypes.length + 1 }, setAccountTypes); setNewAccountType('') } }}
                className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {accountTypes.map(at => (
                <div key={at.id as string} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className={`text-sm ${at.is_active ? 'text-white' : 'text-slate-500 line-through'}`}>{at.name as string}</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={at.is_active as boolean}
                      onCheckedChange={() => toggleActive('account_types', at.id as string, at.is_active as boolean, accountTypes, setAccountTypes)}
                    />
                    <button onClick={() => deleteItem('account_types', at.id as string, setAccountTypes)}
                      className="text-slate-600 hover:text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* SCORING FORMULAS */}
        <TabsContent value="scoring">
          <div className="space-y-4">
            {formulas.map(f => {
              const weightsStr = JSON.stringify(f.weights, null, 2)
              return (
                <FormulaEditor key={f.id as string} formula={f} onSave={saveFormulaWeights} />
              )
            })}
          </div>
        </TabsContent>

        {/* AI PROMPTS */}
        <TabsContent value="ai-prompts">
          <div className="space-y-4">
            {aiPrompts.map(p => (
              <div key={p.id as string} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-medium">{p.name as string}</p>
                    <p className="text-slate-500 text-xs mt-0.5">Type: {p.prompt_type as string}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={p.is_active as boolean}
                      onCheckedChange={async () => {
                        await supabase.from('ai_prompts').update({ is_active: !p.is_active }).eq('id', p.id as string)
                        setAiPrompts(prev => prev.map(pr => pr.id === p.id ? { ...pr, is_active: !p.is_active } : pr))
                      }} />
                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white"
                      onClick={() => { setEditingPrompt(p.id as string); setPromptText(p.system_prompt as string) }}>
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {editingPrompt === p.id ? (
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">System Prompt</Label>
                    <Textarea
                      value={promptText}
                      onChange={e => setPromptText(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white text-xs min-h-[120px] font-mono"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700"
                        onClick={() => savePrompt(p.id as string, promptText)}>
                        <Save className="w-3.5 h-3.5 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-400"
                        onClick={() => setEditingPrompt(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs font-mono bg-slate-900 rounded p-3 line-clamp-3">{p.system_prompt as string}</p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* KEYWORD LIBRARY */}
        <TabsContent value="keywords">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <KeywordLibrary
              initialGroups={keywordGroups as unknown as Parameters<typeof KeywordLibrary>[0]['initialGroups']}
              initialKeywords={keywords as unknown as Parameters<typeof KeywordLibrary>[0]['initialKeywords']}
            />
          </div>
        </TabsContent>

        {/* USERS */}
        <TabsContent value="users">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map(u => (
                  <tr key={u.id as string} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-white">{u.full_name as string ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{u.email as string}</td>
                    <td className="px-4 py-3">
                      {currentUserRole === 'super_admin' ? (
                        <Select value={u.role as string} onValueChange={v => v && updateUserRole(u.id as string, v)}>
                          <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-white text-xs h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {['super_admin', 'admin', 'investigator', 'viewer'].map(r => (
                              <SelectItem key={r} value={r} className="text-white text-xs capitalize">{r.replace('_', ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-slate-300 text-xs capitalize">{(u.role as string).replace('_', ' ')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* LEAD DISCOVERY */}
        <TabsContent value="lead-discovery">
          <div className="grid grid-cols-2 gap-6">
            {/* Entities */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-1">Search Entities</h3>
              <p className="text-slate-500 text-xs mb-4">People, brands, or schemes to monitor.</p>
              <div className="flex items-center gap-2 mb-4">
                <Input
                  placeholder="Entity name…"
                  value={newLeadEntity}
                  onChange={e => setNewLeadEntity(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newLeadEntity) {
                      addItem('lead_entities', { name: newLeadEntity, sort_order: leadEntities.length + 1 }, setLeadEntities)
                      setNewLeadEntity('')
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (newLeadEntity) {
                      addItem('lead_entities', { name: newLeadEntity, sort_order: leadEntities.length + 1 }, setLeadEntities)
                      setNewLeadEntity('')
                    }
                  }}
                  className="bg-teal-700 hover:bg-teal-600 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {leadEntities.map(e => (
                  <div key={e.id as string} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <span className={`text-sm ${e.is_active ? 'text-white' : 'text-slate-500 line-through'}`}>{e.name as string}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={e.is_active as boolean}
                        onCheckedChange={() => toggleActive('lead_entities', e.id as string, e.is_active as boolean, leadEntities, setLeadEntities)}
                      />
                      <button onClick={() => deleteItem('lead_entities', e.id as string, setLeadEntities)}
                        className="text-slate-600 hover:text-red-400 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Keywords — linked from Keyword Library */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-teal-400" />
                <h3 className="text-white font-semibold text-sm">Allegation Keywords</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Keywords for lead search are managed in the <strong className="text-white">Keyword Library</strong> tab.
              </p>
              <p className="text-slate-500 text-xs leading-relaxed">
                Open any keyword group, expand it, and click the <span className="inline-flex items-center gap-1 text-teal-400 mx-0.5"><Radar className="w-3 h-3" /></span> radar icon next to any keyword to enable it for Lead Discovery search. Enabled keywords appear highlighted in teal.
              </p>
              <button
                onClick={() => router.push('/admin?tab=keywords')}
                className="self-start text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2"
              >
                Go to Keyword Library →
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FormulaEditor({ formula, onSave }: { formula: Record<string, unknown>; onSave: (id: string, w: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [weightsJson, setWeightsJson] = useState(JSON.stringify(formula.weights, null, 2))

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-medium">{formula.name as string}</p>
          <p className="text-slate-500 text-xs mt-0.5 capitalize">{(formula.formula_type as string).replace('_', ' ')}</p>
        </div>
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setEditing(!editing)}>
          <Edit3 className="w-4 h-4" />
        </Button>
      </div>
      {editing ? (
        <div className="space-y-2">
          <Label className="text-slate-400 text-xs">Weights (JSON — values must sum to 100)</Label>
          <Textarea
            value={weightsJson}
            onChange={e => setWeightsJson(e.target.value)}
            className="bg-slate-900 border-slate-600 text-white text-xs min-h-[100px] font-mono"
          />
          <div className="flex gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700"
              onClick={() => { onSave(formula.id as string, weightsJson); setEditing(false) }}>
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <pre className="text-slate-500 text-xs font-mono bg-slate-900 rounded p-3 overflow-x-auto">
          {JSON.stringify(formula.weights, null, 2)}
        </pre>
      )}
    </div>
  )
}
