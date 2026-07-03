'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase, ActiveOrder, SessionStatus, MOT_LABEL, MOT_STYLE } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { Activity, CheckCircle, Clock, Users } from 'lucide-react'

const STATUS_COLORS: Record<SessionStatus, string> = {
  waiting: 'bg-gray-100 text-gray-700',
  assigned: 'bg-blue-100 text-blue-700',
  accepted: 'bg-indigo-100 text-indigo-700',
  pickup_done: 'bg-yellow-100 text-yellow-700',
  in_transit: 'bg-orange-100 text-orange-700',
  arrived: 'bg-purple-100 text-purple-700',
  delivered: 'bg-teal-100 text-teal-700',
  returning: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  waiting: 'Waiting',
  assigned: 'Assigned',
  accepted: 'Accepted',
  pickup_done: 'Pickup Done',
  in_transit: 'In Transit',
  arrived: 'Arrived',
  delivered: 'Delivered',
  returning: 'Returning',
  completed: 'Completed',
  failed: 'Failed',
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export default function LiveDashboard() {
  const [orders, setOrders] = useState<ActiveOrder[]>([])
  const [stats, setStats] = useState({ active: 0, completed: 0, riders: 0, avgScore: 0 })
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())

  const loadData = useCallback(async () => {
    const [ordersRes, statsRes] = await Promise.all([
      supabase.from('active_orders_view').select('*').order('assigned_at', { ascending: false }),
      supabase.from('training_sessions').select('status, score, rider_id').filter('created_at', 'gte', new Date(Date.now() - 86400000).toISOString()),
    ])
    if (ordersRes.data) setOrders(ordersRes.data as ActiveOrder[])
    if (statsRes.data) {
      const completed = statsRes.data.filter(r => r.status === 'completed')
      const scores = completed.map(r => r.score).filter(Boolean)
      setStats({
        active: ordersRes.data?.length ?? 0,
        completed: completed.length,
        riders: new Set(statsRes.data.map(r => r.rider_id)).size,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(() => { loadData(); setNow(Date.now()) }, 15000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(interval); clearInterval(tick) }
  }, [loadData])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase.channel('live-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_sessions' }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Real-time training order monitoring · Auto-refreshes every 15s</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Active Orders', value: stats.active, icon: Activity, color: 'text-blue-600 bg-blue-50' },
          { label: 'Completed Today', value: stats.completed, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
          { label: 'Active Riders', value: stats.riders, icon: Users, color: 'text-purple-600 bg-purple-50' },
          { label: 'Avg Score Today', value: stats.avgScore ? `${stats.avgScore}%` : '—', icon: Clock, color: 'text-orange-600 bg-orange-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card flex items-center gap-3">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="section-title">Active Training Orders</h2>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
            Live
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No active orders right now</p>
            <p className="text-gray-400 text-sm mt-1">Assign an order to a rider to start training</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Order', 'Rider', 'MOT', 'Store', 'Location', 'Status', 'Elapsed', 'Assigned'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const elapsed = Math.floor((now - new Date(order.assigned_at).getTime()) / 1000)
                  const isOverdue = elapsed > order.expected_duration * 60 * 1.5
                  return (
                    <tr key={order.id} className={`table-row ${isOverdue ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-mono font-medium text-blue-700">{order.order_code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{order.rider_name}</p>
                        <p className="text-xs text-gray-400">{order.employee_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        {order.mot
                          ? <span className={`badge ${MOT_STYLE[order.mot]}`}>{MOT_LABEL[order.mot]}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{order.store_name}</p>
                        <p className="text-xs text-gray-400">{order.store_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{order.location_name}</p>
                        <p className="text-xs text-gray-400">{order.landmark}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABEL[order.status]}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-mono text-sm ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                        {formatElapsed(elapsed)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {formatDistanceToNow(new Date(order.assigned_at), { addSuffix: true })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
