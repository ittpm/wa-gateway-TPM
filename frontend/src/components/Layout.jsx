import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Smartphone,
  Send,
  ListOrdered,
  Webhook,
  Shield,
  Settings,
  Menu,
  X,
  MessageCircle,
  BookOpen,
  Users,
  FileText,
  User,
  LogOut,
  Crown,
  UserCheck
} from 'lucide-react'
import { api } from '../services/api'
import { getCurrentUser } from '../utils/auth'
import toast from 'react-hot-toast'

const allMenuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/sessions', icon: Smartphone, label: 'Sessions' },
  { path: '/contacts', icon: User, label: 'Contacts' },
  { path: '/groups', icon: Users, label: 'Groups' },
  { path: '/templates', icon: FileText, label: 'Templates' },
  { path: '/history', icon: ListOrdered, label: 'Riwayat Pesan' },
  { path: '/send', icon: Send, label: 'Kirim Pesan' },
  { path: '/queue', icon: ListOrdered, label: 'Antrean' },
  { path: '/webhooks', icon: Webhook, label: 'Webhooks' },
  { path: '/antiblock', icon: Shield, label: 'Anti-Block' },
  { path: '/settings', icon: Settings, label: 'Pengaturan', superadminOnly: true },
  { path: '/docs', icon: BookOpen, label: 'Dokumentasi API' },
]

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const currentUser = getCurrentUser()
  const isSuperadmin = currentUser?.role === 'superadmin'

  // Filter menu berdasarkan role
  const menuItems = allMenuItems.filter(item => !item.superadminOnly || isSuperadmin)

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch { }
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    toast.success('Logout berhasil')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 
                    transform transition-transform duration-300 ease-in-out lg:transform-none
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-whatsapp-500 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl text-gray-900">WA Gateway</h1>
                <p className="text-xs text-gray-500">Multi-Device Gateway</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User Info & Logout Footer */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            {/* User badge */}
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isSuperadmin ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                {isSuperadmin
                  ? <Crown className="w-4 h-4 text-yellow-600" />
                  : <UserCheck className="w-4 h-4 text-blue-600" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{currentUser?.username || 'User'}</p>
                <p className={`text-xs font-medium ${isSuperadmin ? 'text-yellow-600' : 'text-blue-600'}`}>
                  {isSuperadmin ? 'Superadmin' : 'Admin'}
                </p>
              </div>
            </div>
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-whatsapp-500 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">WA Gateway</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
