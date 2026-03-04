import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Settings,
  Database,
  Server,
  Bell,
  Lock,
  Save,
  RotateCcw,
  LogOut,
  Users,
  Plus,
  Trash2,
  Key,
  Crown,
  UserCheck,
  X,
  Edit2,
  Bot
} from 'lucide-react'
import { api } from '../services/api'

function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState({
    apiPort: 9090,
    apiHost: '0.0.0.0',
    dbType: 'sqlite',
    dbConnection: '',
    redisEnabled: false,
    redisUrl: 'redis://localhost:6379',
    webhookRetries: 3,
    webhookTimeout: 30000,
    sumopodApiKey: '',
    sumopodModel: 'seed-2-0-mini-free',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeAiTab, setActiveAiTab] = useState('sumopod')

  // User Management State
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin' })
  const [addingUser, setAddingUser] = useState(false)
  const [editPasswordUser, setEditPasswordUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    fetchSettings()
    fetchUsers()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings')
      if (response.data && typeof response.data === 'object') {
        setSettings(prev => ({ ...prev, ...response.data }))
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      setUsersLoading(true)
      const response = await api.get('/auth/users')
      const rawData = response.data
      setUsers(Array.isArray(rawData) ? rawData : [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.post('/settings', settings)
      toast.success('Pengaturan berhasil disimpan')
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } catch { }
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    toast.success('Logout berhasil')
    navigate('/login')
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (!newUser.username || !newUser.password) {
      toast.error('Username dan password wajib diisi')
      return
    }
    if (newUser.password.length < 6) {
      toast.error('Password minimal 6 karakter')
      return
    }
    setAddingUser(true)
    try {
      await api.post('/auth/users', newUser)
      toast.success(`User "${newUser.username}" berhasil dibuat`)
      setNewUser({ username: '', password: '', role: 'admin' })
      setShowAddUser(false)
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal membuat user')
    } finally {
      setAddingUser(false)
    }
  }

  const handleDeleteUser = async (user) => {
    if (!confirm(`Hapus user "${user.username}"? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      await api.delete(`/auth/users/${user.id}`)
      toast.success(`User "${user.username}" berhasil dihapus`)
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal menghapus user')
    }
  }

  const handleChangeRole = async (user, newRole) => {
    try {
      await api.put(`/auth/users/${user.id}/role`, { role: newRole })
      toast.success(`Role "${user.username}" diubah ke ${newRole}`)
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal mengubah role')
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password minimal 6 karakter')
      return
    }
    try {
      await api.put(`/auth/users/${editPasswordUser.id}/password`, { newPassword })
      toast.success(`Password "${editPasswordUser.username}" berhasil diubah`)
      setEditPasswordUser(null)
      setNewPassword('')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal mengubah password')
    }
  }

  const SectionCard = ({ title, icon: Icon, children }) => (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gray-100 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
          <p className="text-gray-500">Konfigurasi sistem dan manajemen user</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchSettings} className="btn-secondary">
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={saveSettings} disabled={saving} className="btn-primary disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Settings */}
        <SectionCard title="API Server" icon={Server}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                <input type="text" value={settings.apiHost}
                  onChange={(e) => setSettings({ ...settings, apiHost: e.target.value })}
                  className="input-field" placeholder="0.0.0.0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                <input type="number" value={settings.apiPort}
                  onChange={(e) => setSettings({ ...settings, apiPort: parseInt(e.target.value) })}
                  className="input-field" placeholder="9090" />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Database */}
        <SectionCard title="Database" icon={Database}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Database</label>
              <select value={settings.dbType}
                onChange={(e) => setSettings({ ...settings, dbType: e.target.value })}
                className="input-field">
                <option value="sqlite">SQLite (Default)</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>
            {settings.dbType !== 'sqlite' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connection String</label>
                <input type="text" value={settings.dbConnection}
                  onChange={(e) => setSettings({ ...settings, dbConnection: e.target.value })}
                  className="input-field" placeholder="postgres://user:pass@localhost/dbname" />
              </div>
            )}
          </div>
        </SectionCard>

        {/* Account */}
        <SectionCard title="Akun" icon={Lock}>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">🔐 Session-based API Tokens</h4>
              <p className="text-sm text-blue-700">
                Setiap session WhatsApp memiliki token unik yang dibuat secara otomatis saat session dibuat.
                Token ini digunakan untuk integrasi API dari aplikasi eksternal.
              </p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <button onClick={handleLogout}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Webhook Settings */}
        <SectionCard title="Pengaturan Webhook" icon={Bell}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retry Attempts</label>
              <input type="number" min={0} max={10} value={settings.webhookRetries}
                onChange={(e) => setSettings({ ...settings, webhookRetries: parseInt(e.target.value) })}
                className="input-field w-32" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (ms)</label>
              <input type="number" min={1000} max={60000} step={1000} value={settings.webhookTimeout}
                onChange={(e) => setSettings({ ...settings, webhookTimeout: parseInt(e.target.value) })}
                className="input-field w-32" />
            </div>
          </div>
        </SectionCard>

        {/* AI Settings */}
        <SectionCard title="Kecerdasan Buatan (AI) - Auto Reply" icon={Bot}>
          <div className="space-y-4">
            
            {/* Tabs Trigger */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveAiTab('sumopod')}
                className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                  activeAiTab === 'sumopod'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🏅 Utama (SumoPod)
              </button>
              <button
                onClick={() => setActiveAiTab('gemini')}
                className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                  activeAiTab === 'gemini'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🛡️ Cadangan (Gemini)
              </button>
            </div>

            {/* SumoPod */}
            {activeAiTab === 'sumopod' && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input type="password" value={settings.sumopodApiKey || ''}
                      onChange={(e) => setSettings({ ...settings, sumopodApiKey: e.target.value })}
                      className="input-field" placeholder="sk-..." />
                    <p className="text-xs text-gray-500 mt-1">Provider AI utama karena lebih murah dan context lebih besar.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model AI</label>
                    <input type="text" value={settings.sumopodModel || ''}
                      onChange={(e) => setSettings({ ...settings, sumopodModel: e.target.value })}
                      className="input-field" placeholder="seed-2-0-mini-free" />
                  </div>
                </div>
              </div>
            )}

            {/* Gemini */}
            {activeAiTab === 'gemini' && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input type="password" value={settings.geminiApiKey || ''}
                      onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                      className="input-field" placeholder="AlzaSy..." />
                    <p className="text-xs text-gray-500 mt-1">Akan otomatis digunakan jika SumoPod gagal atau sedang offline.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model AI</label>
                    <input type="text" value={settings.geminiModel || ''}
                      onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                      className="input-field" placeholder="gemini-2.0-flash" />
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </SectionCard>
      </div>

      {/* ===== USER MANAGEMENT ===== */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Manajemen User</h2>
              <p className="text-sm text-gray-500">Kelola pengguna dan hak akses sistem</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddUser(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Tambah User
          </button>
        </div>

        {/* Add User Form */}
        {showAddUser && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Tambah User Baru</h3>
              <button onClick={() => setShowAddUser(false)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="input-field"
                  placeholder="contoh: budi"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="input-field"
                  placeholder="Min. 6 karakter"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="input-field"
                >
                  <option value="admin">Admin (tanpa Pengaturan)</option>
                  <option value="superadmin">Superadmin (full akses)</option>
                </select>
              </div>
              <div className="sm:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={addingUser} className="btn-primary disabled:opacity-50">
                  {addingUser ? 'Menyimpan...' : 'Buat User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User List */}
        {usersLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Belum ada user</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${user.role === 'superadmin' ? 'bg-yellow-100' : 'bg-blue-100'
                    }`}>
                    {user.role === 'superadmin'
                      ? <Crown className="w-5 h-5 text-yellow-600" />
                      : <UserCheck className="w-5 h-5 text-blue-600" />
                    }
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.username}</p>
                    <p className={`text-xs font-medium ${user.role === 'superadmin' ? 'text-yellow-600' : 'text-blue-600'}`}>
                      {user.role === 'superadmin' ? '⭐ Superadmin' : '👤 Admin'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Change Role dropdown */}
                  <select
                    value={user.role}
                    onChange={(e) => handleChangeRole(user, e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:border-whatsapp-500 focus:ring-1 focus:ring-whatsapp-500"
                    title="Ubah role"
                  >
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>

                  {/* Change Password button */}
                  <button
                    onClick={() => { setEditPasswordUser(user); setNewPassword('') }}
                    className="p-2 text-gray-500 hover:text-whatsapp-600 hover:bg-whatsapp-50 rounded-lg transition-colors"
                    title="Ubah password"
                  >
                    <Key className="w-4 h-4" />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteUser(user)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      {editPasswordUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Ubah Password — {editPasswordUser.username}
              </h3>
              <button onClick={() => setEditPasswordUser(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field"
                  placeholder="Minimal 6 karakter"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditPasswordUser(null)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  <Key className="w-4 h-4" />
                  Simpan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
