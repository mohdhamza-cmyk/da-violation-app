'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ClipboardList, Plus, Star, Image as ImageIcon, X, ExternalLink, Eye, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format } from 'date-fns'

interface SessionRow {
  id: string
  order_code: string
  status: string
  rider_id: string
  profiles: { full_name: string } | null
  training_locations: { name: string } | null
}

interface EvalRow {
  id: string
  session_id: string
  notes: string
  rating?: number
  created_at: string
  profiles?: { full_name: string }
  evaluator?: { full_name: string }
  training_sessions?: { order_code: string; profiles?: { full_name: string } }
}

interface PodSession {
  id: string
  order_code: string
  pickup_pod_url?: string
  delivery_pod_url?: string
  delivery_geofence_ok?: boolean
  score?: number
  passed?: boolean
  return_completed_at?: string
  profiles?: { full_name: string; employee_id: string } | null
}

function PodThumb({ url, label, onView }: { url: string; label: string; onView: () => void }) {
  const [error, setError] = useState(false)
  if (error) return (
    <div className="w-14 h-14 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
      <ImageIcon className="w-5 h-5 text-gray-300" />
    </div>
  )
  return (
    <button onClick={onView} className="relative group flex-shrink-0">
      <img
        src={url}
        alt={label}
        onError={() => setError(true)}
        className="w-14 h-14 object-cover rounded-lg border border-gray-200"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center">
        <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  )
}

function Lightbox({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <p className="font-medium text-gray-900 text-sm truncate pr-4">{title}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
            >
              <ExternalLink className="w-3 h-3" /> Open Full Size
            </a>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="overflow-auto flex-1 bg-gray-50 flex items-center justify-center p-2">
          <img src={url} alt={title} className="max-w-full max-h-full object-contain rounded" />
        </div>
      </div>
    </div>
  )
}

export default function EvaluationsPage() {
  const [tab, setTab] = useState<'evals' | 'pods'>('evals')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [evals, setEvals] = useState<EvalRow[]>([])
  const [podSessions, setPodSessions] = useState<PodSession[]>([])
  const [loading, setLoading] = useState(true)
  const [podsLoading, setPodsLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ session_id: '', notes: '', rating: 5 })
  const [myId, setMyId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null)

  const loadData = useCallback(async () => {
    const [{ data: { user } }, evalsRes, sessionsRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('evaluations').select(`
        *, profiles!rider_id(full_name), evaluator:profiles!evaluator_id(full_name),
        training_sessions(order_code, profiles!rider_id(full_name))
      `).order('created_at', { ascending: false }).limit(50),
      supabase.from('training_sessions').select('id, order_code, status, profiles!rider_id(full_name), training_locations(name)')
        .eq('status', 'completed').order('return_completed_at', { ascending: false }).limit(100),
    ])
    if (user) setMyId(user.id)
    if (evalsRes.data) setEvals(evalsRes.data as EvalRow[])
    if (sessionsRes.data) setSessions(sessionsRes.data as unknown as SessionRow[])
    setLoading(false)
  }, [])

  const loadPodSessions = useCallback(async () => {
    setPodsLoading(true)
    const { data } = await supabase
      .from('training_sessions')
      .select('id, order_code, pickup_pod_url, delivery_pod_url, delivery_geofence_ok, score, passed, return_completed_at, profiles!rider_id(full_name, employee_id)')
      .not('delivery_pod_url', 'is', null)
      .order('return_completed_at', { ascending: false })
      .limit(60)
    if (data) setPodSessions(data as unknown as PodSession[])
    setPodsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (tab === 'pods') loadPodSessions() }, [tab, loadPodSessions])

  async function handleAdd() {
    if (!form.session_id || !form.notes) { toast.error('Select a session and add notes'); return }
    if (!myId) { toast.error('Not authenticated'); return }
    const sess = sessions.find(s => s.id === form.session_id)
    if (!sess) return
    const { error } = await supabase.from('evaluations').insert({
      session_id: form.session_id,
      rider_id: sess.rider_id,
      evaluator_id: myId,
      notes: form.notes,
      rating: form.rating,
    })
    if (error) { toast.error(error.message); return }
    if (form.notes) {
      await supabase.from('training_sessions').update({ trainer_notes: form.notes }).eq('id', form.session_id)
    }
    toast.success('Evaluation added')
    setShowAdd(false)
    setForm({ session_id: '', notes: '', rating: 5 })
    loadData()
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evaluations</h1>
          <p className="text-gray-500 text-sm mt-0.5">Trainer notes, ratings and POD photos</p>
        </div>
        {tab === 'evals' && (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Evaluation
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('evals')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'evals' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Evaluations</span>
        </button>
        <button
          onClick={() => setTab('pods')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'pods' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> POD Photos</span>
        </button>
      </div>

      {/* Evaluations Tab */}
      {tab === 'evals' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : evals.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No evaluations yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Session', 'Rider', 'Evaluator', 'Rating', 'Notes', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evals.map(e => (
                    <tr key={e.id} className="table-row">
                      <td className="px-4 py-3 font-mono text-blue-700">
                        {(e.training_sessions as { order_code?: string } | undefined)?.order_code ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {(e.profiles as { full_name?: string } | undefined)?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {(e.evaluator as { full_name?: string } | undefined)?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < (e.rating ?? 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-64 truncate">{e.notes}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* POD Photos Tab */}
      {tab === 'pods' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {podsLoading ? (
            <div className="p-12 text-center text-gray-400">Loading photos…</div>
          ) : podSessions.length === 0 ? (
            <div className="p-12 text-center">
              <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No POD photos yet</p>
              <p className="text-gray-400 text-sm mt-1">Photos appear here once riders complete deliveries</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rider</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pickup POD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery POD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Geofence</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {podSessions.map(s => {
                    const rider = s.profiles as { full_name?: string; employee_id?: string } | null
                    return (
                      <tr key={s.id} className="table-row">
                        <td className="px-4 py-3 font-mono text-blue-700 font-medium whitespace-nowrap">{s.order_code}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{rider?.full_name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{rider?.employee_id}</p>
                        </td>
                        <td className="px-4 py-3">
                          {s.pickup_pod_url ? (
                            <PodThumb
                              url={s.pickup_pod_url}
                              label={`${s.order_code} — Pickup POD`}
                              onView={() => setLightbox({ url: s.pickup_pod_url!, title: `${s.order_code} — Pickup POD` })}
                            />
                          ) : (
                            <span className="text-xs text-gray-300 italic">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.delivery_pod_url ? (
                            <PodThumb
                              url={s.delivery_pod_url}
                              label={`${s.order_code} — Delivery POD`}
                              onView={() => setLightbox({ url: s.delivery_pod_url!, title: `${s.order_code} — Delivery POD` })}
                            />
                          ) : (
                            <span className="text-xs text-gray-300 italic">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {s.delivery_geofence_ok === true ? (
                            <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle className="w-3.5 h-3.5" /> OK</span>
                          ) : s.delivery_geofence_ok === false ? (
                            <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3.5 h-3.5" /> Flagged</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {s.score != null ? (
                            <span className={`font-bold text-sm ${s.passed ? 'text-green-600' : 'text-red-500'}`}>
                              {s.score}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell whitespace-nowrap">
                          {s.return_completed_at ? format(new Date(s.return_completed_at), 'd MMM, HH:mm') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Evaluation Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-gray-900">Add Evaluation</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
              <select value={form.session_id} onChange={e => setForm(p => ({ ...p, session_id: e.target.value }))} className="input-field">
                <option value="">Select a completed session…</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.order_code} — {(s.profiles as { full_name?: string } | undefined)?.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(r => (
                  <button key={r} onClick={() => setForm(p => ({ ...p, rating: r }))}
                    className={`w-9 h-9 rounded-lg font-bold transition-colors ${form.rating >= r ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="input-field resize-none" rows={4} placeholder="Evaluation notes…" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleAdd} className="btn-primary flex-1">Save Evaluation</button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox url={lightbox.url} title={lightbox.title} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
