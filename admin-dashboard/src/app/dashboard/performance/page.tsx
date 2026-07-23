'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase, RiderPerformance, StorePerformance } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { BarChart2, TrendingUp, Award } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function PerformancePage() {
  const [riders, setRiders] = useState<RiderPerformance[]>([])
  const [stores, setStores] = useState<StorePerformance[]>([])
  const [sessions, setSessions] = useState<{ score: number; passed: boolean; difficulty: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const [ridersRes, storesRes, sessionsRes] = await Promise.all([
      supabase.from('rider_performance_view').select('*').order('avg_score', { ascending: false }).limit(10),
      supabase.from('store_performance_view').select('*').order('avg_score', { ascending: false }),
      supabase.from('training_sessions').select('score, passed, difficulty, created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(200),
    ])
    if (ridersRes.data) setRiders(ridersRes.data as RiderPerformance[])
    if (storesRes.data) setStores(storesRes.data as StorePerformance[])
    if (sessionsRes.data) setSessions(sessionsRes.data as { score: number; passed: boolean; difficulty: string; created_at: string }[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const passRate = sessions.length ? Math.round(sessions.filter(s => s.passed).length / sessions.length * 100) : 0
  const avgScore = sessions.length ? Math.round(sessions.reduce((a, b) => a + (b.score ?? 0), 0) / sessions.length) : 0

  const difficultyData = ['easy', 'medium', 'hard'].map(d => ({
    name: d.charAt(0).toUpperCase() + d.slice(1),
    count: sessions.filter(s => s.difficulty === d).length,
    passed: sessions.filter(s => s.difficulty === d && s.passed).length,
  }))

  const scoreDistribution = [
    { range: '90-100 (A)', count: sessions.filter(s => (s.score ?? 0) >= 90).length },
    { range: '80-89 (B)', count: sessions.filter(s => (s.score ?? 0) >= 80 && (s.score ?? 0) < 90).length },
    { range: '70-79 (C)', count: sessions.filter(s => (s.score ?? 0) >= 70 && (s.score ?? 0) < 80).length },
    { range: '60-69 (D)', count: sessions.filter(s => (s.score ?? 0) >= 60 && (s.score ?? 0) < 70).length },
    { range: '<60 (F)', count: sessions.filter(s => (s.score ?? 0) < 60).length },
  ]

  if (loading) return <div className="p-12 text-center text-gray-400">Loading performance data…</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Analytics across all training sessions</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Completed', value: sessions.length, icon: BarChart2, color: 'text-blue-600 bg-blue-50' },
          { label: 'Pass Rate', value: `${passRate}%`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Average Score', value: `${avgScore}%`, icon: Award, color: 'text-purple-600 bg-purple-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Score Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="section-title mb-4">Score Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Difficulty Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="section-title mb-4">Sessions by Difficulty</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={difficultyData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, count }) => `${name}: ${count}`}>
                {difficultyData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Riders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="section-title">Top Riders by Score</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['#', 'Rider', 'Store', 'Sessions', 'Avg Score', 'Pass Rate', 'Grade'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riders.slice(0, 10).map((rider, i) => {
                const passRate = rider.completed_sessions > 0
                  ? Math.round(rider.passed_sessions / rider.completed_sessions * 100) : 0
                const score = rider.avg_score ?? 0
                const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
                return (
                  <tr key={rider.rider_id} className="table-row">
                    <td className="px-4 py-3 text-gray-400 font-bold">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{rider.full_name}</p>
                      <p className="text-xs text-gray-400">{rider.employee_id}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{rider.current_store ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{rider.completed_sessions}/{rider.total_sessions}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-20">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${score}%` }} />
                        </div>
                        <span className="font-bold text-blue-700">{score}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${passRate >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{passRate}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-lg ${grade === 'A' ? 'text-green-600' : grade === 'B' ? 'text-blue-600' : grade === 'C' ? 'text-yellow-600' : 'text-red-600'}`}>
                        {rider.avg_score != null ? grade : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Store Performance */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="section-title mb-4">Store Performance</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stores.slice(0, 8).map(s => ({ name: s.store_code, score: s.avg_score ?? 0, sessions: s.completed_sessions }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} domain={[0, 100]} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="score" name="Avg Score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="sessions" name="Sessions" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
