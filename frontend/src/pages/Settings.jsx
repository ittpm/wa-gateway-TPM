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
  CheckCircle,
  LogOut
} from 'lucide-react'
import { api } from '../services/api'

function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState({
    // API Settings
    apiPort: 8080,
    apiHost: '0.0.0.0',
    
    // Database
    dbType: 'sqlite',
    dbConnection: '',
    
    // Redis
    redisEnabled: false,
    redisUrl: 'redis://localhost:6379',
    
    // Notifications
    webhookRetries: 3,
    webhookTimeout: 30000,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings')
      setSettings(response.data)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.post('/settings', settings)
      toast.success('Settings saved successfully')
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Ignore error
    }
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    toast.success('Logged out')
    navigate('/login')
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
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Configure gateway system settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSettings}
            className="btn-secondary"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
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
                <input
                  type="text"
                  value={settings.apiHost}
                  onChange={(e) => setSettings({ ...settings, apiHost: e.target.value })}
                  className="input-field"
                  placeholder="0.0.0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                <input
                  type="number"
                  value={settings.apiPort}
                  onChange={(e) => setSettings({ ...settings, apiPort: parseInt(e.target.value) })}
                  className="input-field"
                  placeholder="8080"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Database */}
        <SectionCard title="Database" icon={Database}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Database Type</label>
              <select
                value={settings.dbType}
                onChange={(e) => setSettings({ ...settings, dbType: e.target.value })}
                className="input-field"
              >
                <option value="sqlite">SQLite (Default)</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>
            {settings.dbType !== 'sqlite' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connection String</label>
                <input
                  type="text"
                  value={settings.dbConnection}
                  onChange={(e) => setSettings({ ...settings, dbConnection: e.target.value })}
                  className="input-field"
                  placeholder="postgres://user:pass@localhost/dbname"
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* Redis */}
        <SectionCard title="Redis / Queue" icon={Server}>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.redisEnabled}
                onChange={(e) => setSettings({ ...settings, redisEnabled: e.target.checked })}
                className="w-5 h-5 text-whatsapp-600 rounded border-gray-300"
              />
              <span className="text-gray-700">Use Redis for queue (recommended for production)</span>
            </label>
            {settings.redisEnabled && (
              <div className="pl-8">
                <label className="block text-sm font-medium text-gray-700 mb-1">Redis URL</label>
                <input
                  type="text"
                  value={settings.redisUrl}
                  onChange={(e) => setSettings({ ...settings, redisUrl: e.target.value })}
                  className="input-field"
                  placeholder="redis://localhost:6379"
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* Account */}
        <SectionCard title="Account" icon={Lock}>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">🔐 Session-based API Tokens</h4>
              <p className="text-sm text-blue-700 mb-2">
                Setiap session WhatsApp memiliki token unik yang dibuat secara otomatis saat session dibuat.
                Token ini digunakan untuk integrasi API dari aplikasi eksternal.
              </p>
              <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                <li>Lihat token di detail session setelah membuat session baru</li>
                <li>Gunakan token sebagai Bearer token atau X-API-Key header</li>
                <li>Token unik per session untuk keamanan terbaik</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Webhook Settings */}
        <SectionCard title="Webhook Settings" icon={Bell}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retry Attempts
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={settings.webhookRetries}
                onChange={(e) => setSettings({ ...settings, webhookRetries: parseInt(e.target.value) })}
                className="input-field w-32"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                min={1000}
                max={60000}
                step={1000}
                value={settings.webhookTimeout}
                onChange={(e) => setSettings({ ...settings, webhookTimeout: parseInt(e.target.value) })}
                className="input-field w-32"
              />
            </div>
          </div>
        </SectionCard>

        {/* System Info */}
        <SectionCard title="System Information" icon={Settings}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Version</span>
              <span className="font-medium text-gray-900">1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">WhatsApp Library</span>
              <span className="font-medium text-gray-900">whatsmeow</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Go Version</span>
              <span className="font-medium text-gray-900">1.21+</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">License</span>
              <span className="font-medium text-gray-900">MIT</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export default SettingsPage
