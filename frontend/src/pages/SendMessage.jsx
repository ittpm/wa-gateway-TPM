import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Send,
  Paperclip,
  Image,
  FileText,
  MapPin,
  User,
  MessageSquare,
  Users,
  Sparkles,
  Smartphone
} from 'lucide-react'
import { api } from '../services/api'
import FileUpload from '../components/FileUpload'

function SendMessage() {
  const [activeTab, setActiveTab] = useState('text')
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [formData, setFormData] = useState({
    sessionId: '',
    to: '',
    message: '',
    mediaUrl: '',
    fileName: '',
    caption: '',
    latitude: '',
    longitude: '',
    contactName: '',
    contactPhone: '',
    useSpintax: false,
    delay: true,
    scheduledAt: '',
  })
  const [selectedFile, setSelectedFile] = useState(null)

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true)
      const response = await api.get('/sessions')
      // Filter hanya session yang connected
      const connectedSessions = response.data.filter(s => s.status === 'connected')
      setSessions(connectedSessions)

      // Auto-select first session if available
      if (connectedSessions.length > 0 && !formData.sessionId) {
        setFormData(prev => ({ ...prev, sessionId: connectedSessions[0].id }))
      }
    } catch (error) {
      toast.error('Failed to load sessions')
      console.error('Error fetching sessions:', error)
    } finally {
      setSessionsLoading(false)
    }
  }

  const tabs = [
    { id: 'text', label: 'Text', icon: MessageSquare },
    { id: 'media', label: 'Media', icon: Image },
    { id: 'document', label: 'Document', icon: FileText },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'contact', label: 'Contact', icon: User },
    { id: 'bulk', label: 'Bulk Send', icon: Users },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validasi sessionId
    if (!formData.sessionId) {
      toast.error('Please select a WhatsApp session first')
      return
    }

    setLoading(true)

    try {
      let endpoint = '/messages/send'
      let payload = { ...formData }

      // Check if we need to upload file
      if ((activeTab === 'media' || activeTab === 'document') && selectedFile) {
        // Use file upload endpoint
        const formDataUpload = new FormData()
        formDataUpload.append('sessionId', formData.sessionId)
        formDataUpload.append('to', formData.to)
        formDataUpload.append('caption', formData.caption || '')
        formDataUpload.append('file', selectedFile)

        const response = await api.post('/messages/send-media', formDataUpload, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })

        if (formData.delay) {
          toast.success(`File uploaded! ${response.data.message}`)
        } else {
          toast.success('File sent successfully!')
        }

        // Reset form
        setFormData(prev => ({
          ...prev,
          to: '',
          caption: '',
        }))
        setSelectedFile(null)
        setLoading(false)
        return
      }

      switch (activeTab) {
        case 'text':
          payload.type = 'text'
          break
        case 'media':
          payload.type = 'image'
          break
        case 'document':
          payload.type = 'document'
          break
        case 'location':
          payload.type = 'location'
          break
        case 'contact':
          payload.type = 'vcard'
          break
        case 'bulk':
          endpoint = '/messages/bulk'
          break
        default:
          payload.type = 'text'
      }

      const response = await api.post(endpoint, payload)

      if (formData.delay) {
        toast.success('Message queued successfully! Will be sent with anti-block delay.')
      } else {
        toast.success('Message sent successfully!')
      }

      // Reset form
      setFormData(prev => ({
        ...prev,
        to: '',
        message: '',
        mediaUrl: '',
        fileName: '',
        caption: '',
      }))
      setSelectedFile(null)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const renderForm = () => {
    switch (activeTab) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Type your message... (Use *bold*, _italic_, ~strikethrough~)"
                className="input-field resize-none"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSpintax"
                checked={formData.useSpintax}
                onChange={(e) => setFormData({ ...formData, useSpintax: e.target.checked })}
                className="w-4 h-4 text-whatsapp-600 rounded border-gray-300"
              />
              <label htmlFor="useSpintax" className="text-sm text-gray-600 flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                Enable Spintax Variation (Anti-Block)
              </label>
            </div>
            {formData.useSpintax && (
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                Use Spintax format: {'{Hello|Hi|Hey}'} {'{there|friend|!}'}
              </div>
            )}
          </div>
        )

      case 'media':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Image/Video
              </label>
              <FileUpload
                onFileSelect={setSelectedFile}
                accept="image/*,video/*"
                maxSize={5 * 1024 * 1024}
              />
            </div>
            <div className="text-center text-sm text-gray-500">or</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input
                type="url"
                value={formData.mediaUrl}
                onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="input-field"
                required={!selectedFile}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption (optional)</label>
              <textarea
                rows={3}
                value={formData.caption}
                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                placeholder="Add a caption to your image..."
                className="input-field resize-none"
              />
            </div>
          </div>
        )

      case 'document':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Document
              </label>
              <FileUpload
                onFileSelect={setSelectedFile}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                maxSize={5 * 1024 * 1024}
              />
            </div>
            <div className="text-center text-sm text-gray-500">or</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document URL</label>
              <input
                type="url"
                value={formData.mediaUrl}
                onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                placeholder="https://example.com/document.pdf"
                className="input-field"
                required={!selectedFile}
              />
            </div>
            {!selectedFile && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
                <input
                  type="text"
                  value={formData.fileName}
                  onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
                  placeholder="document.pdf"
                  className="input-field"
                  required={!selectedFile}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption (optional)</label>
              <textarea
                rows={2}
                value={formData.caption}
                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                placeholder="Add a caption..."
                className="input-field resize-none"
              />
            </div>
          </div>
        )

      case 'location':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="-6.2088"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="106.8456"
                  className="input-field"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption (optional)</label>
              <input
                type="text"
                value={formData.caption}
                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                placeholder="Location description..."
                className="input-field"
              />
            </div>
          </div>
        )

      case 'contact':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="John Doe"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="+6281234567890"
                className="input-field"
                required
              />
            </div>
          </div>
        )

      case 'bulk':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipients (one per line)</label>
              <textarea
                rows={4}
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                placeholder="6281234567890&#10;6289876543210&#10;..."
                className="input-field resize-none font-mono text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Template</label>
              <textarea
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Hello {name|there}, check out our promotion!"
                className="input-field resize-none"
                required
              />
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
              <strong>Bulk Send Mode:</strong> Messages will be queued with smart delays to prevent blocking.
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Send Message</h1>
          <p className="text-gray-500">Send messages with anti-block protection</p>
        </div>
        <button
          onClick={fetchSessions}
          disabled={sessionsLoading}
          className="text-sm text-whatsapp-600 hover:text-whatsapp-700 disabled:opacity-50"
        >
          {sessionsLoading ? 'Loading...' : 'Refresh Sessions'}
        </button>
      </div>

      <div className="card">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.id
                ? 'bg-whatsapp-100 text-whatsapp-700'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Smartphone className="w-4 h-4 inline mr-1" />
              WhatsApp Session
            </label>
            {sessionsLoading ? (
              <div className="input-field bg-gray-50 text-gray-500">
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No connected sessions found. Please connect a session first.
                </p>
                <a
                  href="/sessions"
                  className="text-sm text-whatsapp-600 hover:underline mt-1 inline-block"
                >
                  Go to Sessions →
                </a>
              </div>
            ) : (
              <select
                value={formData.sessionId}
                onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Select a session...</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.phone || session.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Common Fields */}
          {activeTab !== 'bulk' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="tel"
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                placeholder="6281234567890 (without + or spaces)"
                className="input-field"
                required
              />
            </div>
          )}

          {/* Dynamic Form Fields */}
          {renderForm()}

          {/* Options */}
          <div className="flex flex-col gap-3 py-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useDelay"
                checked={formData.delay}
                onChange={(e) => setFormData({ ...formData, delay: e.target.checked })}
                className="w-4 h-4 text-whatsapp-600 rounded border-gray-300"
              />
              <label htmlFor="useDelay" className="text-sm text-gray-600">
                Use Anti-Block Delay (Recommended)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSchedule"
                checked={!!formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.checked ? new Date().toISOString().slice(0, 16) : '' })}
                className="w-4 h-4 text-whatsapp-600 rounded border-gray-300"
              />
              <label htmlFor="useSchedule" className="text-sm text-gray-600">
                Schedule Message
              </label>
            </div>

            {formData.scheduledAt && (
              <div className="ml-6">
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  className="input-field max-w-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Message will be queued and sent at this time.
                </p>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || sessions.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {activeTab === 'bulk' ? 'Queue Messages' : 'Send Message'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SendMessage
