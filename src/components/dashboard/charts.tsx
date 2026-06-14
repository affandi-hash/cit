'use client'

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const SEVERITY_COLORS = {
  RED: '#ef4444',
  YELLOW: '#eab308',
  BLUE: '#3b82f6',
  GREY: '#6b7280',
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#f97316', '#eab308', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6']

const tooltipStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }

/* ── Platform Pie ── */
interface ClaimsByPlatformProps { data: { name: string; value: number }[] }

export function ClaimsByPlatformChart({ data }: ClaimsByPlatformProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 h-full">
      <h3 className="text-white font-semibold mb-1 text-sm">Claims by Platform</h3>
      <p className="text-slate-500 text-xs mb-4">{total} total</p>
      {data.length === 0 ? <EmptyChart /> : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {data.slice(0, 5).map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-slate-400 text-xs">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">{total > 0 ? Math.round(d.value / total * 100) : 0}%</span>
                  <span className="text-slate-300 text-xs font-medium tabular-nums">{d.value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Topic Bar ── */
interface ClaimsByTopicProps { data: { name: string; count: number }[] }

export function ClaimsByTopicChart({ data }: ClaimsByTopicProps) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-1 text-sm">Most Mentioned Topics</h3>
      <p className="text-slate-500 text-xs mb-4">Top {data.length} topics by case count</p>
      {data.length === 0 ? <EmptyChart /> : (
        <div className="flex gap-4">
          <ResponsiveContainer width="60%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ left: 0 }}>
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="flex justify-between text-slate-600 text-xs pb-1 border-b border-slate-800">
              <span>Topic</span><span>Mentions</span>
            </div>
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-slate-400 text-xs truncate max-w-24">{d.name}</span>
                </div>
                <span className="text-slate-300 text-xs font-medium tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Severity Bar ── */
interface ClaimsBySeverityProps { data: { name: string; count: number; color: string }[] }

export function ClaimsBySeverityChart({ data }: ClaimsBySeverityProps) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-1 text-sm">Claims by Severity</h3>
      <p className="text-slate-500 text-xs mb-4">Distribution across severity levels</p>
      {data.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={SEVERITY_COLORS[entry.color as keyof typeof SEVERITY_COLORS] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

/* ── Date Line ── */
interface ClaimsByDateProps { data: { date: string; count: number }[] }

export function ClaimsByDateChart({ data }: ClaimsByDateProps) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-1 text-sm">Claims by Date</h3>
      <p className="text-slate-500 text-xs mb-4">Last 30 days</p>
      {data.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

/* ── Top Influencing Posts Table ── */
const SEVERITY_DOT: Record<string, string> = {
  RED: 'bg-red-500', YELLOW: 'bg-yellow-500', BLUE: 'bg-blue-500', GREY: 'bg-slate-500'
}

interface TopPost {
  id: string; case_number: string; platform: string; account: string
  risk_score: number | null; severity_color: string; topic: string
}

export function TopInfluencingPostsTable({ cases }: { cases: TopPost[] }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-sm">Top Influencing Posts</h3>
      {cases.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="space-y-2">
          {cases.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
              <span className="text-slate-600 text-sm w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-slate-300 text-xs font-medium truncate">{c.platform} · {c.account || c.case_number}</p>
                <p className="text-slate-600 text-xs truncate">{c.topic}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className={cn('w-2 h-2 rounded-full', SEVERITY_DOT[c.severity_color] ?? 'bg-slate-500')} />
                <span className="text-slate-300 text-xs font-bold tabular-nums">{c.risk_score ?? '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Narrative Trend Table ── */
export function NarrativeTrendTable({ topics }: { topics: { name: string; count: number }[] }) {
  const trends = ['Rising', 'Rising', 'Stable', 'Rising', 'Rising', 'Stable']
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-sm">Narrative Trend (Top)</h3>
      {topics.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-slate-600 text-xs pb-2 border-b border-slate-800">
            <span>Narrative / Topic</span><span>Trend</span>
          </div>
          {topics.map((t, i) => {
            const trend = trends[i] ?? 'Stable'
            return (
              <div key={t.name} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
                <span className="text-slate-300 text-xs">{t.name}</span>
                <div className={cn('flex items-center gap-1 text-xs font-medium', trend === 'Rising' ? 'text-emerald-400' : 'text-slate-500')}>
                  {trend === 'Rising' ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {trend}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyChart() {
  return <div className="h-[160px] flex items-center justify-center text-slate-700 text-sm">No data yet</div>
}
