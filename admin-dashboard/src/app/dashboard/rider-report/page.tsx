'use client'
export const dynamic = 'force-dynamic'
import { useState, useCallback, Fragment } from 'react'
import { supabase, Mot, MOT_VALUES, MOT_LABEL, MOT_STYLE } from '@/lib/supabase'
import { CalendarClock, Download, ChevronDown, ChevronRight, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, subDays } from 'date-fns'

type Breakdown = { acceptance?: number; pickup?: number; travel?: number; return?: number; pod?: number; geofence?: number }
interface Row {
  id: string
  order_code: string
  mot?: Mot
  status: string
  score: number | null
  passed: boolean | null
  grade: string | null
  score_breakdown: Breakdown | null
  assigned_at: string
  accepted_at: string | null
  pickup_completed_at: string | null
  departed_at: string | null
  arrived_at: string | null
  return_completed_at: string | null
  delivery_geofence_ok: boolean | null
  return_geofence_ok: boolean | null
  profiles?: { full_name: string; employee_id: string; mot?: Mot } | null
  stores?: { name: string; store_code: string } | null
  training_locations?: { name: string } | null
}

const COMPONENTS: { key: keyof Breakdown; label: string; weight: string }[] = [
  { key: 'acceptance', label: 'Accept', weight: '15%' },
  { key: 'pickup', label: 'Pickup', weight: '15%' },
  { key: 'travel', label: 'Travel', weight: '30%' },
  { key: 'return', label: 'Return', weight: '20%' },
  { key: 'pod', label: 'POD', weight: '15%' },
  { key: 'geofence', label: 'Geofence', weight: '5%' },
]

function avg(nums: number[]): number | null { return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null }
function scoreColor(s?: number | null) {
  if (s == null) return 'text-gray-400'
  if (s >= 80) return 'text-green-600'
  if (s >= 70) return 'text-amber-600'
  return 'text-red-600'
}
function gradeStyle(g?: string | null) {
  switch (g) {
    case 'A': return 'bg-green-100 text-green-700'
    case 'B': return 'bg-emerald-100 text-emerald-700'
    case 'C': return 'bg-amber-100 text-amber-700'
    case 'D': return 'bg-orange-100 text-orange-700'
    default: return 'bg-red-100 text-red-700'
  }
}

export default function RiderReportPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [motFilter, setMotFilter] = useState<string>('all')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('training_sessions').select(`
      id, order_code, mot, status, score, passed, grade, score_breakdown,
      assigned_at, accepted_at, pickup_completed_at, departed_at, arrived_at, return_completed_at,
      delivery_geofence_ok, return_geofence_ok,
      profiles!rider_id(full_name, employee_id, mot),
      stores!store_id(name, store_code),
      training_locations!location_id(name)
    `)
      .gte('assigned_at', `${from}T00:00:00Z`)
      .lte('assigned_at', `${to}T23:59:59Z`)
      .order('assigned_at', { ascending: false })
    if (motFilter !== 'all') q = q.eq('mot', motFilter)
    const { data, error } = await q
    setLoading(false); setRan(true)
    if (error) { toast.error(error.message); return }
    setRows((data ?? []) as unknown as Row[])
  }, [from, to, motFilter])

  // group by rider
  const groups = Array.from(
    rows.reduce((m, r) => {
      const key = r.profiles?.employee_id ?? r.id
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(r)
      return m
    }, new Map<string, Row[]>()).entries()
  ).map(([key, sessions]) => {
    const scored = sessions.filter(s => s.score != null)
    const comp: Record<string, number | null> = {}
    for (const c of COMPONENTS) comp[c.key] = avg(scored.map(s => Number(s.score_breakdown?.[c.key] ?? 0)))
    return {
      key,
      rider: sessions[0].profiles?.full_name ?? 'Rider',
      employee_id: sessions[0].profiles?.employee_id ?? '—',
      mot: sessions[0].profiles?.mot,
      sessions,
      total: sessions.length,
      completed: sessions.filter(s => s.status === 'completed').length,
      passed: sessions.filter(s => s.passed).length,
      avgScore: avg(scored.map(s => Number(s.score))),
      comp,
    }
  }).sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))

  const totals = {
    riders: groups.length,
    sessions: rows.length,
    avgScore: avg(rows.filter(r => r.score != null).map(r => Number(r.score))),
    passRate: (() => { const sc = rows.filter(r => r.score != null); return sc.length ? Math.round(100 * sc.filter(r => r.passed).length / sc.length) : null })(),
  }

  function exportCSV() {
    if (!rows.length) { toast.error('Nothing to export — run the report first'); return }
    const headers = ['date', 'rider', 'employee_id', 'mot', 'order_code', 'store', 'location', 'status', 'final_score', 'grade', 'passed', 'acceptance', 'pickup', 'travel', 'return', 'pod', 'geofence']
    const lines = rows.map(r => [
      format(new Date(r.assigned_at), 'yyyy-MM-dd HH:mm'),
      r.profiles?.full_name ?? '', r.profiles?.employee_id ?? '', r.mot ?? '',
      r.order_code, r.stores?.name ?? '', r.training_locations?.name ?? '', r.status,
      r.score ?? '', r.grade ?? '', r.passed ?? '',
      r.score_breakdown?.acceptance ?? '', r.score_breakdown?.pickup ?? '', r.score_breakdown?.travel ?? '',
      r.score_breakdown?.return ?? '', r.score_breakdown?.pod ?? '', r.score_breakdown?.geofence ?? '',
    ].map(v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(','))
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `rider-report-${from}-to-${to}.csv`; a.click()
    toast.success(`${rows.length} sessions exported`)
  }

  function toggle(k: string) { setOpen(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n }) }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rider Performance Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">Per-rider metrics and final scores for a chosen date range</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 self-start"><Download className="w-4 h-4" /> Export CSV</button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To date</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mode of transport</label>
            <select value={motFilter} onChange={e => setMotFilter(e.target.value)} className="input-field">
              <option value="all">All</option>
              {MOT_VALUES.map(m => <option key={m} value={m}>{MOT_LABEL[m]}</option>)}
            </select>
          </div>
          <button onClick={load} disabled={loading} className="btn-primary flex items-center justify-center gap-2">
            <CalendarClock className="w-4 h-4" /> {loading ? 'Loading…' : 'Run report'}
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      {ran && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { l: 'Riders', v: totals.riders },
            { l: 'Sessions', v: totals.sessions },
            { l: 'Avg final score', v: totals.avgScore != null ? `${totals.avgScore}` : '—' },
            { l: 'Pass rate', v: totals.passRate != null ? `${totals.passRate}%` : '—' },
          ].map(t => (
            <div key={t.l} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-900 tabular-nums">{t.v}</div>
              <div className="text-xs text-gray-500 mt-1">{t.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Rider table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {!ran ? (
          <div className="p-12 text-center text-gray-400">Choose a date range and run the report.</div>
        ) : loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No sessions in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Rider', 'MOT', 'Sessions', 'Completed', 'Passed', 'Avg Score', ...COMPONENTS.map(c => c.label)].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <Fragment key={g.key}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggle(g.key)}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {open.has(g.key) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          <div>
                            <p className="font-medium text-gray-900">{g.rider}</p>
                            <p className="text-xs text-gray-400 font-mono">{g.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">{g.mot ? <span className={`badge ${MOT_STYLE[g.mot]}`}>{MOT_LABEL[g.mot]}</span> : '—'}</td>
                      <td className="px-3 py-3 tabular-nums">{g.total}</td>
                      <td className="px-3 py-3 tabular-nums">{g.completed}</td>
                      <td className="px-3 py-3"><span className={`badge ${g.passed > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{g.passed}</span></td>
                      <td className={`px-3 py-3 font-bold tabular-nums ${scoreColor(g.avgScore)}`}>{g.avgScore != null ? `${g.avgScore}` : '—'}</td>
                      {COMPONENTS.map(c => (
                        <td key={c.key} className="px-3 py-3 tabular-nums text-gray-600">{g.comp[c.key] != null ? g.comp[c.key] : '—'}</td>
                      ))}
                    </tr>
                    {open.has(g.key) && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={6 + COMPONENTS.length} className="px-3 pb-4 pt-1">
                          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                            <table className="w-full text-xs min-w-[820px]">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  {['Date', 'Order', 'MOT', 'Location', 'Status', 'Final', 'Grade', ...COMPONENTS.map(c => c.label)].map(h => (
                                    <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {g.sessions.map(s => (
                                  <tr key={s.id} className="border-t border-gray-100">
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{format(new Date(s.assigned_at), 'dd MMM, HH:mm')}</td>
                                    <td className="px-3 py-2 font-mono text-blue-700">{s.order_code}</td>
                                    <td className="px-3 py-2">{s.mot ? MOT_LABEL[s.mot] : '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">{s.training_locations?.name ?? '—'}</td>
                                    <td className="px-3 py-2 capitalize">{s.status.replace('_', ' ')}</td>
                                    <td className={`px-3 py-2 font-bold tabular-nums ${scoreColor(s.score)}`}>{s.score != null ? Math.round(Number(s.score)) : '—'}</td>
                                    <td className="px-3 py-2">{s.grade ? <span className={`badge ${gradeStyle(s.grade)}`}>{s.grade}</span> : '—'}</td>
                                    {COMPONENTS.map(c => (
                                      <td key={c.key} className="px-3 py-2 tabular-nums text-gray-500">{s.score_breakdown?.[c.key] != null ? s.score_breakdown[c.key] : '—'}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
