'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, Profile } from '@/lib/supabase'
import { Users, Plus, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  associate: 'bg-blue-100 text-blue-700',
  rider: 'bg-gray-100 text-gray-700',
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ full_name: '', employee_id: '', email: '', password: '', role: 'associate', phone: '' })

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').in('role', ['admin', 'associate']).order('full_name')
    if (data) setUsers(data as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleCreate() {
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, employee_id: form.employee_id, role: form.role } },
    })
    if (error || !data.user) { toast.error(error?.message ?? 'Failed'); return }
    if (form.phone) await supabase.from('profiles').update({ phone: form.phone }).eq('id', data.user.id)
    toast.success('User created')
    setShowCreate(false)
    loadUsers()
  }

  async function toggleActive(user: Profile) {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    if (error) { toast.error(error.message); return }
    toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`)
    loadUsers()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">Admins and Logistics Associates</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No staff users yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Name', 'Employee ID', 'Role', 'Phone', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600">{user.employee_id}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{user.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(user)} className="text-xs text-blue-600 hover:underline">
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-gray-900">Add Staff User</h2>
            {[
              { label: 'Full Name', key: 'full_name', type: 'text' },
              { label: 'Employee ID', key: 'employee_id', type: 'text' },
              { label: 'Phone', key: 'phone', type: 'tel' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Password', key: 'password', type: 'password' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type} value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="input-field" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="input-field">
                <option value="associate">Logistics Associate</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} className="btn-primary flex-1">Create</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
