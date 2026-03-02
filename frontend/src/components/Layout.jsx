import { useState, useEffect } from 'react'
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
  UserCheck,
  Calendar,
  ChevronDown,
  BookMarked,
  Clock
} from 'lucide-react'
import { api } from '../services/api'
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
  { path: '/scheduled', icon: Calendar, label: 'Pesan Terjadwal' },
  { path: '/webhooks', icon: Webhook, label: 'Webhooks' },
  { path: '/antiblock', icon: Shield, label: 'Anti-Block' },
  { path: '/settings', icon: Settings, label: 'Pengaturan', superadminOnly: true },
]

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // Ambil info user dari API /auth/me agar selalu dapat role terbaru
    // ini juga berfungsi meski token ada di cookie (bukan hanya localStorage)
    const fetchUser = async () => {
      try {
        const response = await api.get('/auth/me')
        if (response.data?.user) {
          setCurrentUser(response.data.user)
        }
      } catch {
        // Tidak perlu handle error, user akan diredirect oleh ProtectedRoute
      }
    }
    fetchUser()
  }, [])

  const isSuperadmin = currentUser?.role === 'superadmin'
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
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {currentTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'medium' })} WIB
                </p>
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

            {/* Dokumentasi API — Sub-menu */}
            <div>
              <button
                onClick={() => setDocsOpen(prev => !prev)}
                className="sidebar-link w-full text-left"
              >
                <BookOpen className="w-5 h-5" />
                <span className="flex-1">Dokumentasi API</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${docsOpen ? 'rotate-180' : ''}`} />
              </button>

              {docsOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  <NavLink
                    to="/docs/umum"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${isActive ? 'bg-whatsapp-50 text-whatsapp-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`
                    }
                  >
                    <BookOpen className="w-4 h-4" />
                    API Umum
                  </NavLink>
                  <NavLink
                    to="/docs/advanced"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${isActive ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`
                    }
                  >
                    <BookMarked className="w-4 h-4" />
                    API Advanced
                  </NavLink>
                </div>
              )}
            </div>
          </nav>

          {/* User Info & Logout Footer */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isSuperadmin ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                {isSuperadmin
                  ? <Crown className="w-4 h-4 text-yellow-600" />
                  : <UserCheck className="w-4 h-4 text-blue-600" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {currentUser?.username || '...'}
                </p>
                <p className={`text-xs font-medium ${isSuperadmin ? 'text-yellow-600' : 'text-blue-600'}`}>
                  {currentUser ? (isSuperadmin ? 'Superadmin' : 'Admin') : 'Memuat...'}
                </p>
              </div>
            </div>
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
            <div className="flex flex-col">
              <span className="font-semibold text-gray-900 text-sm">WA Gateway</span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {currentTime.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
              </span>
            </div>
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
