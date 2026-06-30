'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

interface WaitingSession {
  id: string
  order_code: string
  created_at: string
  location_id: string | null
  profiles?: { full_name: string; employee_id: string } | null
  stores?: { name: string } | null
  training_locations?: { name: string; landmark: string | null } | null
}

interface LocationOption {
  id: string
  name: string
  difficulty: string
}

export default function AssignPage() {
  const [waiting, setWaiting] = useState<WaitingSession[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [sessionsRes, locsRes] = await Promise.all([
      supabase
        .from('training_sessions')
        .select('id, order_code, created_at, location_id, profiles!rider_id(full_name, employee_id), stores(name), training_locations(name, landmark)')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true }),
      supabase
        .from('training_locations')
        .select('id, name, difficulty')
        .eq('is_active', true)
        .order('name'),
    ])
    if (sessionsRes.data) setWaiting(sessionsRes.data as unknown as WaitingSession[])
    if (locsRes.data) setLocations(locsRes.data as LocationOption[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('assign-waiting')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_sessions' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  async function assign(session: WaitingSession) {
    setAssigning(session.id)
    const locationId = picked[session.id] || session.location_id
    const update: Record<string, unknown> = { status: 'assigned', assigned_at: new Date().toISOString() }
    if (locationId) update.location_id = locationId
    const { error } = await supabase.from('training_sessions').update(update).eq('id', session.id)
    setAssigning(null)
    if (error) {
      toast.error(`Assign failed: ${error.message}`)
      return
    }
    toast.success(`Assigned ${session.order_code} to ${session.profiles?.full_name ?? 'rider'}`)
    load()
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assign Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Riders waiting in the queue. Assign an order to send them to the Accept screen.</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : waiting.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
          No riders are waiting right now. When a rider taps <span className="font-medium">Ready for Training</span> in the app, they appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {waiting.map(s => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-gray-900">{s.order_code}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    waiting {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  {s.profiles?.full_name ?? 'Rider'} <span className="text-gray-400">({s.profiles?.employee_id ?? '—'})</span>
                  {s.stores?.name ? <> · <span className="text-gray-500">{s.stores.name}</span></> : null}
                </div>
              </div>
              <select
                value={picked[s.id] ?? s.location_id ?? ''}
                onChange={e => setPicked(p => ({ ...p, [s.id]: e.target.value }))}
                className="input-field lg:w-64"
              >
                <option value="">{s.training_locations?.name ? `Keep: ${s.training_locations.name}` : 'Select destination'}</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.difficulty})</option>
                ))}
              </select>
              <button
                onClick={() => assign(s)}
                disabled={assigning === s.id}
                className="btn-primary flex items-center justify-center gap-2 lg:w-40"
              >
                <Send className="w-4 h-4" />
                {assigning === s.id ? 'Assigning…' : 'Assign Order'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
