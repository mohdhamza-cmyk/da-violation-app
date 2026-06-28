'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, Store, MapPin, BarChart2,
  FileText, LogOut, Bike, Bell, ClipboardList, X
} from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Live Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/riders', label: 'Riders', icon: Bike },
  { href: '/dashboard/stores', label: 'Dark Stores', icon: Store },
  { href: '/dashboard/locations', label: 'Locations', icon: MapPin },
  { href: '/dashboard/performance', label: 'Performance', icon: BarChart2 },
  { href: '/dashboard/evaluations', label: 'Evaluations', icon: ClipboardList },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/users', label: 'Users', icon: Users },
]

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  const inner = (
    <aside className="w-64 h-full min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Rider Training</p>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href)
          return (
            <Link key={href} href={href} onClick={onClose}
              className={`sidebar-link ${isActive ? 'active' : ''}`}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden lg:block flex-shrink-0">{inner}</div>

      {/* Mobile: slide-in overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <div className="relative z-10">{inner}</div>
        </div>
      )}
    </>
  )
}
