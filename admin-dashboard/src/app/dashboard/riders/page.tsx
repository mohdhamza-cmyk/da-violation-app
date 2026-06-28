'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, Profile, Store, RiderPerformance } from '@/lib/supabase'
import { Users, Search, Plus, ChevronRight, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export default function RidersPage() {
  const [riders, setRiders] = useState<RiderPerformance[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedRider, setSelectedRider] = useState<(Profile & { sessions?: { score?: number; status: string; created_at: string }[] }) | null>(null)
  const [showAssign, setShowAssign] = useState<Profile | null>(null)
  const [assignStore, setAssignStore] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newRider, setNewRider] = useState({ full_name: '', employee_id: '', phone: '', email: '', password: '' })

  const loadData = useCallback(async () => {
    const [ridersRes, storesRes] = await Promise.all([
      supabase.from('rider_performance_view').select('*').order('full_name'),
      supabase.from('stores').select('*').eq('is_active', true).order('name'),
    ])
    if (ridersRes.data) setRiders(ridersRes.data as RiderPerformance[])
    if (storesRes.data) setStores(storesRes.data as Store[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = riders.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.employee_id.toLowerCase().includes(search.toLowerCase()) ||
    r.current_store?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAssignStore() {
    if (!showAssign || !assignStore) return
    const { error } = await supabase.from('profiles').update({ store_id: assignStore }).eq('id', showAssign.id)
    if (error) { toast.error(error.message); return }
    await supabase.from('rider_store_assignments').update({ is_current: false }).eq('rider_id', showAssign.id)
    await supabase.from('rider_store_assignments').insert({ rider_id: showAssign.id, store_id: assignStore, is_current: true })
    toast.success('Rider assigned to store')
    setShowAssign(null)
    loadData()
  }

  async function handleCreateRider() {
    const { data, error } = await supabase.auth.signUp({
      email: newRider.email,
      password: newRider.password,
      options: {
        data: { full_name: newRider.full_name, employee_id: newRider.employee_id, role: 'rider' }
      }
    })
    if (error || !data.user) { toast.error(error?.message ?? 'Failed'); return }
    if (newRider.phone) {
      await supabase.from('profiles').update({ phone: newRider.phone }).eq('id', data.user.id)
    }
    toast.success('Rider created')
    setShowCreate(false)
    setNewRider({ full_name: '', employee_id: '', phone: '', email: '', password: '' })
    loadData()
  }

  const scoreColor = (score?: number) => {
    if (!score) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{riders.length} riders registered</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Rider
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input-field pl-10" placeholder="Search by name, ID, or store…" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No riders found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {['Rider', 'Store', 'Sessions', 'Avg Score', 'Passed', 'Last Active', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(rider => (
                <tr key={rider.rider_id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                        {rider.full_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{rider.full_name}</p>
                        <p className="text-xs text-gray-400">{rider.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{rider.current_store ?? <span className="text-gray-400 italic">Unassigned</span>}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{rider.completed_sessions}</span>
                    <span className="text-gray-400">/{rider.total_sessions}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${scoreColor(rider.avg_score)}`}>
                      {rider.avg_score != null ? `${rider.avg_score}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${rider.passed_sessions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {rider.passed_sessions} passed
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {rider.last_session_at
                      ? formatDistanceToNow(new Date(rider.last_session_at), { addSuffix: true })
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setShowAssign(rider as unknown as Profile)}
                        className="text-xs text-blue-600 hover:underline">Assign Store</button>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Store Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Assign Store — {showAssign.full_name}</h2>
            <select value={assignStore} onChange={e => setAssignStore(e.target.value)} className="input-field mb-4">
              <option value="">Select a store…</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={handleAssignStore} className="btn-primary flex-1">Assign</button>
              <button onClick={() => setShowAssign(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Rider Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-gray-900 mb-2">Add New Rider</h2>
            {[
              { label: 'Full Name', key: 'full_name', type: 'text' },
              { label: 'Employee ID', key: 'employee_id', type: 'text' },
              { label: 'Phone', key: 'phone', type: 'tel' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Password', key: 'password', type: 'password' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type} value={(newRider as Record<string, string>)[key]}
                  onChange={e => setNewRider(prev => ({ ...prev, [key]: e.target.value }))}
                  className="input-field" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreateRider} className="btn-primary flex-1">Create</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
