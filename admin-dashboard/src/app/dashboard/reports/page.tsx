'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, Download, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, subDays } from 'date-fns'

function toCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return ''
  const headers = Object.keys(data[0])
  const rows = data.map(row => headers.map(h => {
    const v = row[h]
    if (v === null || v === undefined) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(','))
  return [headers.join(','), ...rows].join('\n')
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [storeId, setStoreId] = useState('')
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

  async function loadStores() {
    if (stores.length) return
    setLoadingStores(true)
    const { data } = await supabase.from('stores').select('id, name').eq('is_active', true).order('name')
    if (data) setStores(data)
    setLoadingStores(false)
  }

  async function generateReport(type: string) {
    setGenerating(type)
    try {
      let query
      if (type === 'sessions') {
        query = supabase.from('training_sessions').select(`
          order_code, status, difficulty, score, passed, grade,
          assigned_at, accepted_at, pickup_completed_at, arrived_at, delivered_at, return_completed_at,
          trainer_notes, delivery_geofence_ok, return_geofence_ok,
          profiles!rider_id(full_name, employee_id),
          stores!store_id(name, store_code),
          training_locations!location_id(name)
        `)
        .gte('assigned_at', `${dateFrom}T00:00:00Z`)
        .lte('assigned_at', `${dateTo}T23:59:59Z`)
        .order('assigned_at', { ascending: false })
      } else if (type === 'riders') {
        query = supabase.from('rider_performance_view').select('*').order('full_name')
      } else {
        query = supabase.from('store_performance_view').select('*').order('store_name')
      }

      if (storeId && type === 'sessions') {
        (query as ReturnType<typeof supabase.from>).eq('store_id', storeId)
      }

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) { toast.error('No data for the selected filters'); return }

      const flat = (data as Record<string, unknown>[]).map(row => {
        const profiles = row.profiles as Record<string, string> | null
        const stores = row.stores as Record<string, string> | null
        const locations = row.training_locations as Record<string, string> | null
        return {
          ...(profiles ? { rider_name: profiles.full_name, employee_id: profiles.employee_id } : {}),
          ...(stores ? { store: stores.name, store_code: stores.store_code } : {}),
          ...(locations ? { location: locations.name } : {}),
          ...Object.fromEntries(
            Object.entries(row).filter(([k]) => !['profiles','stores','training_locations'].includes(k))
          ),
        }
      })

      const csv = toCSV(flat)
      downloadCSV(csv, `${type}-report-${dateFrom}-to-${dateTo}.csv`)
      toast.success(`${data.length} records exported`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setGenerating(null)
    }
  }

  const REPORTS = [
    {
      type: 'sessions',
      title: 'Training Sessions Report',
      desc: 'All training sessions with scores, timestamps, POD status, and trainer notes',
      icon: '📋',
    },
    {
      type: 'riders',
      title: 'Rider Performance Report',
      desc: 'Aggregated performance metrics for all riders',
      icon: '🏍️',
    },
    {
      type: 'stores',
      title: 'Store Performance Report',
      desc: 'Training statistics broken down by dark store',
      icon: '🏪',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Export</h1>
        <p className="text-gray-500 text-sm mt-0.5">Generate and download CSV reports</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="section-title mb-4 flex items-center gap-2"><Filter className="w-4 h-4" /> Report Filters</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Store (sessions only)</label>
            <select value={storeId} onChange={e => setStoreId(e.target.value)} className="input-field"
              onFocus={loadStores}>
              <option value="">All Stores</option>
              {loadingStores && <option disabled>Loading…</option>}
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORTS.map(({ type, title, desc, icon }) => (
          <div key={type} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col">
            <div className="text-3xl mb-3">{icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 mb-4 flex-1">{desc}</p>
            <button
              onClick={() => generateReport(type)}
              disabled={generating === type}
              className="btn-primary flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              {generating === type ? 'Generating…' : 'Export CSV'}
            </button>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Reports export as CSV. Open in Excel or Google Sheets for further analysis. Date filters apply to the sessions report only.
        </p>
      </div>
    </div>
  )
}
