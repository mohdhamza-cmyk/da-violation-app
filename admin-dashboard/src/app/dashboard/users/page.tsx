'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase, createUserAdmin, Profile } from '@/lib/supabase'
import { Users, Plus, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import BulkUpload from '@/components/BulkUpload'

const STAFF_ROLES = [
  { value: 'associate', label: 'Logistics Associate' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'area_manager', label: 'Area Manager (AM)' },
  { value: 'city_manager', label: 'City Manager' },
  { value: 'admin', label: 'Admin' },
]

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  associate: 'bg-blue-100 text-blue-700',
  trainer: 'bg-green-100 text-green-700',
  supervisor: 'bg-yellow-100 text-yellow-700',
  area_manager: 'bg-orange-100 text-orange-700',
  city_manager: 'bg-red-100 text-red-700',
  rider: 'bg-gray-100 text-gray-700',
}

const STAFF_ROLE_VALUES = STAFF_ROLES.map(r => r.value)

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ full_name: '', employee_id: '', email: '', password: '', role: 'associate', phone: '' })

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*')
      .in('role', STAFF_ROLE_VALUES).order('full_name')
    if (data) setUsers(data as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleCreate() {
    const { error } = await createUserAdmin({
      email: form.email, password: form.password, full_name: form.full_name,
      employee_id: form.employee_id, phone: form.phone, role: form.role,
    })
    if (error) { toast.error(error); return }
    toast.success('User created')
    setShowCreate(false)
    setForm({ full_name: '', employee_id: '', email: '', password: '', role: 'associate', phone: '' })
    loadUsers()
  }

  async function toggleActive(user: Profile) {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    if (error) { toast.error(error.message); return }
    toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`)
    loadUsers()
  }

  async function handleBulkUpload(rows: Record<string, string>[]) {
    let success = 0
    const errors: string[] = []
    for (const row of rows) {
      if (!row.email || !row.password || !row.full_name || !row.employee_id) {
        errors.push(`Row missing required fields: ${row.email || '(no email)'}`)
        continue
      }
      const role = row.role && STAFF_ROLE_VALUES.includes(row.role) ? row.role : 'associate'
      const { error } = await createUserAdmin({
        email: row.email.trim(), password: row.password.trim(), full_name: row.full_name,
        employee_id: row.employee_id, phone: row.phone, role,
      })
      if (error) { errors.push(`${row.email}: ${error}`); continue }
      success++
    }
    loadUsers()
    return { success, errors }
  }

  const roleLabel = (role: string) => STAFF_ROLES.find(r => r.value === role)?.label ?? role

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">Admins, Associates, Trainers & Managers</p>
        </div>
        <div className="flex gap-2">
          <BulkUpload
            label="Staff Users"
            templateHeaders={['full_name', 'employee_id', 'email', 'password', 'phone', 'role']}
            templateExample={[
              { full_name: 'Ahmed Ali', employee_id: 'EMP-001', email: 'ahmed@company.com', password: 'Pass@123', phone: '+971501234567', role: 'associate' },
              { full_name: 'Sara Khan', employee_id: 'EMP-002', email: 'sara@company.com', password: 'Pass@123', phone: '+971509876543', role: 'trainer' },
            ]}
            onUpload={handleBulkUpload}
          />
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center rounded-xl overflow-hidden">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No staff users yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Employee ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-purple-600" />
                        </div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 hidden sm:table-cell">{user.employee_id}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{user.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(user)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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
                {STAFF_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
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
