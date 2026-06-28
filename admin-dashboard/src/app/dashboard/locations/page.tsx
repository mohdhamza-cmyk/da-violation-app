'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase, TrainingLocation, Store, DifficultyLevel } from '@/lib/supabase'
import { MapPin, Plus, Pencil, ToggleLeft, ToggleRight, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import BulkUpload from '@/components/BulkUpload'

const DIFF_COLORS: Record<DifficultyLevel, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
}

const EMPTY_LOC = {
  name: '', latitude: 0, longitude: 0, landmark: '', notes: '',
  difficulty: 'easy' as DifficultyLevel, expected_duration: 10,
  geofence_radius_meters: 50, store_id: '', is_active: true
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<TrainingLocation[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<TrainingLocation> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [filterDiff, setFilterDiff] = useState<string>('all')

  const loadData = useCallback(async () => {
    const [locsRes, storesRes] = await Promise.all([
      supabase.from('training_locations').select('*, stores(name)').order('name'),
      supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    ])
    if (locsRes.data) setLocations(locsRes.data as TrainingLocation[])
    if (storesRes.data) setStores(storesRes.data as Store[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = filterDiff === 'all' ? locations : locations.filter(l => l.difficulty === filterDiff)

  async function handleSave() {
    if (!editing) return
    if (!editing.name || !editing.latitude || !editing.longitude) {
      toast.error('Name, latitude and longitude are required'); return
    }
    const payload = {
      name: editing.name, latitude: editing.latitude, longitude: editing.longitude,
      landmark: editing.landmark, notes: editing.notes, difficulty: editing.difficulty,
      expected_duration: editing.expected_duration,
      geofence_radius_meters: editing.geofence_radius_meters ?? 50,
      store_id: editing.store_id || null, is_active: editing.is_active ?? true,
    }
    if (isNew) {
      const { error } = await supabase.from('training_locations').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Location created')
    } else {
      const { error } = await supabase.from('training_locations').update(payload).eq('id', editing.id!)
      if (error) { toast.error(error.message); return }
      toast.success('Location updated')
    }
    setEditing(null)
    loadData()
  }

  async function toggleActive(loc: TrainingLocation) {
    await supabase.from('training_locations').update({ is_active: !loc.is_active }).eq('id', loc.id)
    toast.success(`Location ${loc.is_active ? 'deactivated' : 'activated'}`)
    loadData()
  }

  async function handleBulkUpload(rows: Record<string, string>[]) {
    let success = 0
    const errors: string[] = []
    for (const row of rows) {
      if (!row.name || !row.latitude || !row.longitude) {
        errors.push(`Row missing required fields: ${row.name || '(no name)'}`)
        continue
      }
      let storeId: string | null = null
      if (row.store_code) {
        const { data } = await supabase.from('stores').select('id').eq('store_code', row.store_code.trim()).single()
        storeId = data?.id ?? null
      }
      const { error } = await supabase.from('training_locations').insert({
        name: row.name.trim(),
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        landmark: row.landmark?.trim() || null,
        notes: row.notes?.trim() || null,
        difficulty: (['easy', 'medium', 'hard'].includes(row.difficulty) ? row.difficulty : 'easy') as DifficultyLevel,
        expected_duration: parseInt(row.expected_duration) || 10,
        geofence_radius_meters: parseInt(row.geofence_radius_meters) || 50,
        store_id: storeId,
        is_active: true,
      })
      if (error) { errors.push(`${row.name}: ${error.message}`); continue }
      success++
    }
    loadData()
    return { success, errors }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Locations</h1>
          <p className="text-gray-500 text-sm mt-0.5">{locations.length} delivery destinations configured</p>
        </div>
        <div className="flex gap-2">
          <BulkUpload
            label="Locations"
            templateHeaders={['name', 'latitude', 'longitude', 'landmark', 'notes', 'difficulty', 'expected_duration', 'geofence_radius_meters', 'store_code']}
            templateExample={[
              { name: 'Al Barsha Mall', latitude: '25.1122', longitude: '55.1993', landmark: 'Near entrance gate', notes: 'Parking available', difficulty: 'easy', expected_duration: '15', geofence_radius_meters: '50', store_code: 'DS-001' },
              { name: 'JLT Tower 5', latitude: '25.0657', longitude: '55.1385', landmark: 'Blue building', notes: 'Elevator required', difficulty: 'medium', expected_duration: '20', geofence_radius_meters: '50', store_code: 'DS-002' },
            ]}
            onUpload={handleBulkUpload}
          />
          <button onClick={() => { setEditing({ ...EMPTY_LOC }); setIsNew(true) }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Location
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'easy', 'medium', 'hard'].map(d => (
          <button key={d} onClick={() => setFilterDiff(d)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterDiff === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-12 text-center text-gray-400">Loading…</div>
        ) : filtered.map(loc => (
          <div key={loc.id} className={`bg-white rounded-xl border shadow-sm p-5 ${loc.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{loc.name}</p>
                  {loc.landmark && <p className="text-xs text-gray-400">{loc.landmark}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing({ ...loc }); setIsNew(false) }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <Pencil className="w-4 h-4 text-gray-400" />
                </button>
                <button onClick={() => toggleActive(loc)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  {loc.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                </button>
              </div>
            </div>
            {loc.notes && <p className="text-xs text-gray-500 mb-3">{loc.notes}</p>}
            <div className="text-xs text-gray-400 font-mono mb-3">
              {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`badge ${DIFF_COLORS[loc.difficulty]}`}>
                  {loc.difficulty.charAt(0).toUpperCase() + loc.difficulty.slice(1)}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {loc.expected_duration} min
                </span>
              </div>
              {loc.stores && <span className="text-xs text-gray-400">{(loc.stores as Store).name}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-3 my-4">
            <h2 className="font-semibold text-gray-900">{isNew ? 'Add Location' : 'Edit Location'}</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location Name *</label>
              <input type="text" value={editing.name ?? ''} className="input-field"
                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latitude *</label>
                <input type="number" step="any" value={editing.latitude ?? ''} className="input-field"
                  onChange={e => setEditing(p => ({ ...p, latitude: parseFloat(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Longitude *</label>
                <input type="number" step="any" value={editing.longitude ?? ''} className="input-field"
                  onChange={e => setEditing(p => ({ ...p, longitude: parseFloat(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Landmark</label>
              <input type="text" value={editing.landmark ?? ''} className="input-field"
                onChange={e => setEditing(p => ({ ...p, landmark: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={editing.notes ?? ''} className="input-field resize-none" rows={2}
                onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                <select value={editing.difficulty ?? 'easy'} className="input-field"
                  onChange={e => setEditing(p => ({ ...p, difficulty: e.target.value as DifficultyLevel }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Expected Duration (min)</label>
                <input type="number" value={editing.expected_duration ?? 10} className="input-field"
                  onChange={e => setEditing(p => ({ ...p, expected_duration: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Geofence Radius (m)</label>
                <input type="number" value={editing.geofence_radius_meters ?? 50} className="input-field"
                  onChange={e => setEditing(p => ({ ...p, geofence_radius_meters: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Store (optional)</label>
                <select value={editing.store_id ?? ''} className="input-field"
                  onChange={e => setEditing(p => ({ ...p, store_id: e.target.value }))}>
                  <option value="">All Stores</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} className="btn-primary flex-1">{isNew ? 'Create Location' : 'Save Changes'}</button>
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
