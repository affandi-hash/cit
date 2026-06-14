'use client'

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, ResponsiveContainer, Legend
} from 'recharts'

const SEVERITY_COLORS = {
  RED: '#ef4444',
  YELLOW: '#eab308',
  BLUE: '#3b82f6',
  GREY: '#6b7280',
}

interface ClaimsByPlatformProps {
  data: { name: string; value: number }[]
}
export function ClaimsByPlatformChart({ data }: ClaimsByPlatformProps) {
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-sm">Claims by Platform</h3>
      {data.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={false} labelLine={false}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

interface ClaimsByTopicProps {
  data: { name: string; count: number }[]
}
export function ClaimsByTopicChart({ data }: ClaimsByTopicProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-sm">Claims by Topic</h3>
      {data.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
            <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

interface ClaimsBySeverityProps {
  data: { name: string; count: number; color: string }[]
}
export function ClaimsBySeverityChart({ data }: ClaimsBySeverityProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-sm">Claims by Severity</h3>
      {data.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
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

interface ClaimsByDateProps {
  data: { date: string; count: number }[]
}
export function ClaimsByDateChart({ data }: ClaimsByDateProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-sm">Claims by Date</h3>
      {data.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
            <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">
      No data yet
    </div>
  )
}
