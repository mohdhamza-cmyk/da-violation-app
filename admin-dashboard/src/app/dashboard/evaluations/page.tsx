'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, TrainingSession, TrainingLocation, Profile } from '@/lib/supabase'
import { ClipboardList, Plus, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

interface SessionRow extends TrainingSession {
  profiles: Profile
  training_locations: TrainingLocation
  stores: { name: string }
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

export default function EvaluationsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [evals, setEvals] = useState<EvalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ session_id: '', notes: '', rating: 5 })
  const [myId, setMyId] = useState<string | null>(null)

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
    if (sessionsRes.data) setSessions(sessionsRes.data as SessionRow[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evaluations</h1>
          <p className="text-gray-500 text-sm mt-0.5">Trainer notes and ratings for completed sessions</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Evaluation
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : evals.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No evaluations yet</p>
          </div>
        ) : (
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
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
    </div>
  )
}
