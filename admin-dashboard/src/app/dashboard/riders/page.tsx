'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase, Profile, Store, RiderPerformance, Mot, MOT_VALUES, MOT_LABEL, MOT_STYLE } from '@/lib/supabase'
import { Users, Search, Plus, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import BulkUpload from '@/components/BulkUpload'

function parseMot(v?: string): Mot { const s = (v ?? '').trim().toLowerCase(); return (MOT_VALUES as string[]).includes(s) ? s as Mot : 'rider' }

export default function RidersPage() {
  const [riders, setRiders] = useState<RiderPerformance[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [search, setSearch] = useState('')
  const [filterMot, setFilterMot] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<RiderPerformance | null>(null)
  const [editStore, setEditStore] = useState('')
  const [editMot, setEditMot] = useState<Mot>('rider')
  const [showCreate, setShowCreate] = useState(false)
  const [newRider, setNewRider] = useState({ full_name: '', employee_id: '', phone: '', email: '', password: '', mot: 'rider' as Mot })

  const loadData = useCallback(async () => {
    const [ridersRes, storesRes, motRes] = await Promise.all([
      supabase.from('rider_performance_view').select('*').order('full_name'),
      supabase.from('stores').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, mot').eq('role', 'rider'),
    ])
    const motMap = new Map((motRes.data ?? []).map((p: { id: string; mot: Mot }) => [p.id, p.mot]))
    if (ridersRes.data) {
      setRiders((ridersRes.data as RiderPerformance[]).map(r => ({ ...r, mot: motMap.get(r.rider_id) })))
    }
    if (storesRes.data) setStores(storesRes.data as Store[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = riders.filter(r =>
    (filterMot === 'all' || r.mot === filterMot) &&
    (r.full_name.toLowerCase().includes(search.toLowerCase()) ||
     r.employee_id.toLowerCase().includes(search.toLowerCase()) ||
     r.current_store?.toLowerCase().includes(search.toLowerCase()))
  )

  function openEdit(rider: RiderPerformance) {
    setEditing(rider); setEditStore(rider.store_id ?? ''); setEditMot(rider.mot ?? 'rider')
  }

  async function handleEditSave() {
    if (!editing) return
    const update: Record<string, unknown> = { mot: editMot }
    if (editStore) update.store_id = editStore
    const { error } = await supabase.from('profiles').update(update).eq('id', editing.rider_id)
    if (error) { toast.error(error.message); return }
    if (editStore) {
      await supabase.from('rider_store_assignments').update({ is_current: false }).eq('rider_id', editing.rider_id)
      await supabase.from('rider_store_assignments').insert({ rider_id: editing.rider_id, store_id: editStore, is_current: true })
    }
    toast.success('Rider updated')
    setEditing(null)
    loadData()
  }

  async function handleCreateRider() {
    const { data, error } = await supabase.auth.signUp({
      email: newRider.email,
      password: newRider.password,
      options: { data: { full_name: newRider.full_name, employee_id: newRider.employee_id, role: 'rider', mot: newRider.mot } }
    })
    if (error || !data.user) { toast.error(error?.message ?? 'Failed'); return }
    if (newRider.phone) await supabase.from('profiles').update({ phone: newRider.phone }).eq('id', data.user.id)
    toast.success('Rider created')
    setShowCreate(false)
    setNewRider({ full_name: '', employee_id: '', phone: '', email: '', password: '', mot: 'rider' })
    loadData()
  }

  async function handleBulkUpload(rows: Record<string, string>[]) {
    let success = 0
    const errors: string[] = []
    for (const row of rows) {
      if (!row.email || !row.password || !row.full_name || !row.employee_id) {
        errors.push(`Row missing required fields: ${row.email || '(no email)'}`)
        continue
      }
      const { data, error } = await supabase.auth.signUp({
        email: row.email.trim(),
        password: row.password.trim(),
        options: { data: { full_name: row.full_name, employee_id: row.employee_id, role: 'rider', mot: parseMot(row.mot) } }
      })
      if (error || !data.user) { errors.push(`${row.email}: ${error?.message ?? 'Failed'}`); continue }
      if (row.phone) await supabase.from('profiles').update({ phone: row.phone }).eq('id', data.user.id)
      success++
    }
    loadData()
    return { success, errors }
  }

  const scoreColor = (score?: number) => {
    if (!score) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{riders.length} riders · tagged by mode of transport</p>
        </div>
        <div className="flex gap-2">
          <BulkUpload
            label="Riders"
            templateHeaders={['full_name', 'employee_id', 'email', 'password', 'phone', 'mot']}
            templateExample={[
              { full_name: 'Mohammed Hassan', employee_id: 'RDR-001', email: 'rider1@company.com', password: 'Pass@123', phone: '+971501234567', mot: 'walker' },
              { full_name: 'Ali Ahmed', employee_id: 'RDR-002', email: 'rider2@company.com', password: 'Pass@123', phone: '+971509876543', mot: 'cyclist' },
              { full_name: 'Sara Khan', employee_id: 'RDR-003', email: 'rider3@company.com', password: 'Pass@123', phone: '+971555555555', mot: 'rider' },
            ]}
            onUpload={handleBulkUpload}
          />
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Rider
          </button>
        </div>
      </div>

      {/* Search + MOT filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-10" placeholder="Search by name, ID, or store…" />
        </div>
        <div className="flex gap-2">
          {['all', ...MOT_VALUES].map(m => (
            <button key={m} onClick={() => setFilterMot(m)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filterMot === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              {m === 'all' ? 'All' : MOT_LABEL[m as Mot]}
            </button>
          ))}
        </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Rider', 'MOT', 'Store', 'Sessions', 'Avg Score', 'Passed', 'Last Active', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(rider => (
                  <tr key={rider.rider_id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {rider.full_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{rider.full_name}</p>
                          <p className="text-xs text-gray-400">{rider.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${rider.mot ? MOT_STYLE[rider.mot] : 'bg-gray-100 text-gray-500'}`}>
                        {rider.mot ? MOT_LABEL[rider.mot] : '—'}
                      </span>
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
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {rider.last_session_at ? formatDistanceToNow(new Date(rider.last_session_at), { addSuffix: true }) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 items-center">
                        <button onClick={() => openEdit(rider)}
                          className="text-xs text-blue-600 hover:underline whitespace-nowrap">Edit</button>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Rider Modal (Store + MOT) */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Edit Rider — {editing.full_name}</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mode of Transport</label>
              <select value={editMot} onChange={e => setEditMot(e.target.value as Mot)} className="input-field">
                {MOT_VALUES.map(m => <option key={m} value={m}>{MOT_LABEL[m]}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Orders are drawn from this MOT&rsquo;s locations.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Store</label>
              <select value={editStore} onChange={e => setEditStore(e.target.value)} className="input-field">
                <option value="">Keep current</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={handleEditSave} className="btn-primary flex-1">Save</button>
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Rider Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mode of Transport</label>
              <select value={newRider.mot} onChange={e => setNewRider(prev => ({ ...prev, mot: e.target.value as Mot }))} className="input-field">
                {MOT_VALUES.map(m => <option key={m} value={m}>{MOT_LABEL[m]}</option>)}
              </select>
            </div>
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
