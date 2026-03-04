import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Shield,
  Clock,
  Shuffle,
  Thermometer,
  Filter,
  AlertTriangle,
  Info,
  Save,
  RotateCcw
} from 'lucide-react'
import { api } from '../services/api'

function AntiBlock() {
  const [settings, setSettings] = useState({
    // Rate Limiting
    rateLimitEnabled: true,
    messagesPerMinute: 5,
    messagesPerHour: 50,
    burstLimit: 10,
    
    // Random Delay
    delayEnabled: true,
    minDelay: 1,
    maxDelay: 5,
    baseDelay: 2,
    
    // Warm-up Mode
    warmupEnabled: true,
    warmupDays: 7,
    warmupDay1Limit: 10,
    warmupDay7Limit: 100,
    
    // Content Spinner
    spintaxEnabled: true,
    
    // Number Filter
    numberFilterEnabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/antiblock/settings')
      if (response.data) {
        setSettings(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.post('/antiblock/settings', settings)
      toast.success('Anti-block settings saved')
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const resetSettings = async () => {
    try {
      await api.post('/antiblock/settings/reset')
      toast.success('Settings reset to defaults')
      fetchSettings()
    } catch (error) {
      toast.error('Failed to reset settings')
    }
  }

  const SectionCard = ({ title, icon: Icon, description, children }) => (
    <div className="card">
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-whatsapp-100 rounded-lg">
          <Icon className="w-6 h-6 text-whatsapp-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-64">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anti-Block Protection</h1>
          <p className="text-gray-500">Configure settings to prevent WhatsApp account blocking</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetSettings}
            className="btn-secondary"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-amber-800">Important Notice</h3>
          <p className="text-sm text-amber-700 mt-1">
            These settings help reduce the risk of being blocked, but they don't guarantee complete protection. 
            Always use WhatsApp responsibly and follow their Terms of Service.
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rate Limiting */}
        <SectionCard
          title="Smart Rate Limiting"
          icon={Clock}
          description="Limit message sending to avoid detection"
        >
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.rateLimitEnabled}
                onChange={(e) => setSettings({ ...settings, rateLimitEnabled: e.target.checked })}
                className="w-5 h-5 text-whatsapp-600 rounded border-gray-300"
              />
              <span className="text-gray-700">Enable rate limiting</span>
            </label>
            
            {settings.rateLimitEnabled && (
              <div className="space-y-4 pl-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Messages per minute
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settings.messagesPerMinute}
                    onChange={(e) => setSettings({ ...settings, messagesPerMinute: parseInt(e.target.value) })}
                    className="input-field w-32"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Messages per hour
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={settings.messagesPerHour}
                    onChange={(e) => setSettings({ ...settings, messagesPerHour: parseInt(e.target.value) })}
                    className="input-field w-32"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Burst limit (short spike allowance)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.burstLimit}
                    onChange={(e) => setSettings({ ...settings, burstLimit: parseInt(e.target.value) })}
                    className="input-field w-32"
                  />
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Random Delay */}
        <SectionCard
          title="Random Delay"
          icon={Shuffle}
          description="Add randomized delays between messages"
        >
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.delayEnabled}
                onChange={(e) => setSettings({ ...settings, delayEnabled: e.target.checked })}
                className="w-5 h-5 text-whatsapp-600 rounded border-gray-300"
              />
              <span className="text-gray-700">Enable random delays</span>
            </label>
            
            {settings.delayEnabled && (
              <div className="space-y-4 pl-8">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min delay (seconds)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={settings.minDelay}
                      onChange={(e) => setSettings({ ...settings, minDelay: parseInt(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max delay (seconds)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={settings.maxDelay}
                      onChange={(e) => setSettings({ ...settings, maxDelay: parseInt(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                  Formula: Delay = {settings.baseDelay}s + random({settings.minDelay}s - {settings.maxDelay}s)
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Warm-up Mode */}
        <SectionCard
          title="Warm-up Mode"
          icon={Thermometer}
          description="Gradually increase limits for new numbers"
        >
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.warmupEnabled}
                onChange={(e) => setSettings({ ...settings, warmupEnabled: e.target.checked })}
                className="w-5 h-5 text-whatsapp-600 rounded border-gray-300"
              />
              <span className="text-gray-700">Enable warm-up mode</span>
            </label>
            
            {settings.warmupEnabled && (
              <div className="space-y-4 pl-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warm-up period (days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settings.warmupDays}
                    onChange={(e) => setSettings({ ...settings, warmupDays: parseInt(e.target.value) })}
                    className="input-field w-32"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Day 1 limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={settings.warmupDay1Limit}
                      onChange={(e) => setSettings({ ...settings, warmupDay1Limit: parseInt(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Day {settings.warmupDays} limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={settings.warmupDay7Limit}
                      onChange={(e) => setSettings({ ...settings, warmupDay7Limit: parseInt(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Content Spinner & Number Filter */}
        <SectionCard
          title="Additional Protection"
          icon={Shield}
          description="Extra anti-block features"
        >
          <div className="space-y-4">
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-whatsapp-300 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={settings.spintaxEnabled}
                onChange={(e) => setSettings({ ...settings, spintaxEnabled: e.target.checked })}
                className="w-5 h-5 text-whatsapp-600 rounded border-gray-300 mt-0.5"
              />
              <div>
                <span className="font-medium text-gray-900">Content Spinner (Spintax)</span>
                <p className="text-sm text-gray-500 mt-1">
                  Enable message variation using Spintax format: {'{Hello|Hi|Hey}'}
                </p>
              </div>
            </label>
            
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-whatsapp-300 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={settings.numberFilterEnabled}
                onChange={(e) => setSettings({ ...settings, numberFilterEnabled: e.target.checked })}
                className="w-5 h-5 text-whatsapp-600 rounded border-gray-300 mt-0.5"
              />
              <div>
                <span className="font-medium text-gray-900">Number Filter / Validator</span>
                <p className="text-sm text-gray-500 mt-1">
                  Check if number is registered on WhatsApp before sending
                </p>
              </div>
            </label>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export default AntiBlock
