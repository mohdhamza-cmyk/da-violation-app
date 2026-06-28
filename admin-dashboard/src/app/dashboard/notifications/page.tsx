'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

interface NotifRow {
  id: string
  recipient_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
  profiles?: { full_name: string; employee_id: string }
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<NotifRow[]>([])
  const [riders, setRiders] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showSend, setShowSend] = useState(false)
  const [form, setForm] = useState({ recipient_id: '', title: '', body: '', type: 'info' })

  const loadData = useCallback(async () => {
    const [notifsRes, ridersRes] = await Promise.all([
      supabase.from('notifications').select('*, profiles!recipient_id(full_name, employee_id)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('id, full_name').eq('role', 'rider').eq('is_active', true).order('full_name'),
    ])
    if (notifsRes.data) setNotifs(notifsRes.data as NotifRow[])
    if (ridersRes.data) setRiders(ridersRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function sendNotification() {
    if (!form.recipient_id || !form.title || !form.body) {
      toast.error('Fill in all fields'); return
    }
    const { error } = await supabase.from('notifications').insert({
      recipient_id: form.recipient_id,
      title: form.title,
      body: form.body,
      type: form.type,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Notification sent')
    setShowSend(false)
    setForm({ recipient_id: '', title: '', body: '', type: 'info' })
    loadData()
  }

  const TYPE_COLORS: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm mt-0.5">In-app notifications sent to riders</p>
        </div>
        <button onClick={() => setShowSend(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Send Notification
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No notifications yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Recipient', 'Title', 'Message', 'Type', 'Read', 'Sent'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifs.map(n => (
                <tr key={n.id} className={`table-row ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{n.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{n.profiles?.employee_id}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{n.title}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-48 truncate">{n.body}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-600'}`}>{n.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    {n.is_read
                      ? <span className="badge bg-gray-100 text-gray-500">Read</span>
                      : <span className="badge bg-blue-100 text-blue-600">Unread</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showSend && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-gray-900">Send Notification</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recipient</label>
              <select value={form.recipient_id} onChange={e => setForm(p => ({ ...p, recipient_id: e.target.value }))} className="input-field">
                <option value="">Select rider…</option>
                {riders.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="input-field">
                {['info', 'success', 'warning', 'error'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
              <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} className="input-field resize-none" rows={3} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={sendNotification} className="btn-primary flex-1">Send</button>
              <button onClick={() => setShowSend(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
