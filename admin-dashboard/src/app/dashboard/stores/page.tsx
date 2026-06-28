'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase, Store } from '@/lib/supabase'
import { Store as StoreIcon, Plus, Pencil, ToggleLeft, ToggleRight, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_STORE: Partial<Store> = { store_code: '', name: '', latitude: 0, longitude: 0, address: '', city: '', is_active: true }

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Store> | null>(null)
  const [isNew, setIsNew] = useState(false)

  const loadStores = useCallback(async () => {
    const { data } = await supabase.from('stores').select('*').order('name')
    if (data) setStores(data as Store[])
    setLoading(false)
  }, [])

  useEffect(() => { loadStores() }, [loadStores])

  async function handleSave() {
    if (!editing) return
    if (!editing.store_code || !editing.name || !editing.latitude || !editing.longitude) {
      toast.error('Please fill in all required fields'); return
    }
    if (isNew) {
      const { error } = await supabase.from('stores').insert(editing)
      if (error) { toast.error(error.message); return }
      toast.success('Store created')
    } else {
      const { error } = await supabase.from('stores').update(editing).eq('id', editing.id!)
      if (error) { toast.error(error.message); return }
      toast.success('Store updated')
    }
    setEditing(null)
    loadStores()
  }

  async function toggleActive(store: Store) {
    const { error } = await supabase.from('stores').update({ is_active: !store.is_active }).eq('id', store.id)
    if (error) { toast.error(error.message); return }
    toast.success(`Store ${store.is_active ? 'deactivated' : 'activated'}`)
    loadStores()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dark Stores</h1>
          <p className="text-gray-500 text-sm mt-0.5">{stores.length} stores configured</p>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY_STORE }); setIsNew(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Store
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-12 text-center text-gray-400">Loading…</div>
        ) : stores.map(store => (
          <div key={store.id} className={`bg-white rounded-xl border shadow-sm p-5 ${store.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <StoreIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{store.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{store.store_code}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing({ ...store }); setIsNew(false) }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4 text-gray-400" />
                </button>
                <button onClick={() => toggleActive(store)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  {store.is_active
                    ? <ToggleRight className="w-5 h-5 text-green-500" />
                    : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                </button>
              </div>
            </div>
            {(store.address || store.city) && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                <MapPin className="w-3 h-3" /> {[store.address, store.city].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="text-xs text-gray-400 font-mono">
              {Number(store.latitude).toFixed(6)}, {Number(store.longitude).toFixed(6)}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className={`badge ${store.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {store.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold text-gray-900">{isNew ? 'Add Store' : 'Edit Store'}</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Store Code *', key: 'store_code', type: 'text', full: false },
                { label: 'Store Name *', key: 'name', type: 'text', full: true },
                { label: 'Latitude *', key: 'latitude', type: 'number', full: false },
                { label: 'Longitude *', key: 'longitude', type: 'number', full: false },
                { label: 'Address', key: 'address', type: 'text', full: true },
                { label: 'City', key: 'city', type: 'text', full: false },
              ].map(({ label, key, type, full }) => (
                <div key={key} className={full ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={(editing as Record<string, unknown>)[key] as string ?? ''}
                    onChange={e => setEditing(prev => ({ ...prev, [key]: type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                    className="input-field" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} className="btn-primary flex-1">
                {isNew ? 'Create Store' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
