import { useState, useEffect, useRef, useCallback } from 'react'
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
  Smartphone,
  Search,
  X
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

  // Contact picker states
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState([])
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [contactLoading, setContactLoading] = useState(false)
  const [selectedContactName, setSelectedContactName] = useState('')
  const contactDropdownRef = useRef(null)
  const debounceRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target)) {
        setShowContactDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  // Fetch contact suggestions with debounce 300ms
  const handleContactSearch = useCallback((value) => {
    setContactSearch(value)
    setFormData(prev => ({ ...prev, to: value }))
    setSelectedContactName('')

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim() || value.length < 2) {
      setContactResults([])
      setShowContactDropdown(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      if (!formData.sessionId) return
      setContactLoading(true)
      try {
        const res = await api.get(`/sessions/${formData.sessionId}/contacts`, {
          params: { search: value }
        })
        const contacts = (res.data?.contacts || []).filter(c => !c.isGroup).slice(0, 10)
        setContactResults(contacts)
        setShowContactDropdown(contacts.length > 0)
      } catch {
        setContactResults([])
        setShowContactDropdown(false)
      } finally {
        setContactLoading(false)
      }
    }, 300)
  }, [formData.sessionId])

  const handleSelectContact = (contact) => {
    const phone = contact.phone
    setFormData(prev => ({ ...prev, to: phone }))
    setContactSearch(phone)
    setSelectedContactName(contact.name || phone)
    setShowContactDropdown(false)
    setContactResults([])
  }

  const handleClearContact = () => {
    setFormData(prev => ({ ...prev, to: '' }))
    setContactSearch('')
    setSelectedContactName('')
    setContactResults([])
    setShowContactDropdown(false)
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

          {/* Common Fields - Contact Picker */}
          {activeTab !== 'bulk' && (
            <div ref={contactDropdownRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                To (Penerima)
              </label>

              {/* Selected contact badge */}
              {selectedContactName && (
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-whatsapp-50 border border-whatsapp-200 text-whatsapp-800 text-sm px-3 py-1.5 rounded-full">
                    <div className="w-5 h-5 rounded-full bg-whatsapp-500 text-white text-xs flex items-center justify-center font-bold">
                      {selectedContactName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{selectedContactName}</span>
                    <span className="text-whatsapp-600 font-mono text-xs">· {formData.to}</span>
                  </div>
                  <button type="button" onClick={handleClearContact} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Input with search icon */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => handleContactSearch(e.target.value)}
                  onFocus={() => contactResults.length > 0 && setShowContactDropdown(true)}
                  placeholder={formData.sessionId ? "Cari nama/nomor kontak atau ketik nomor manual..." : "Pilih session dulu, lalu cari kontak..."}
                  className="input-field pl-9 pr-8"
                  required
                  disabled={!formData.sessionId}
                />
                {contactLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-whatsapp-500/30 border-t-whatsapp-500 rounded-full animate-spin" />
                )}
              </div>

              {/* Dropdown contact results */}
              {showContactDropdown && contactResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
                    {contactResults.length} kontak ditemukan — klik untuk pilih
                  </div>
                  <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                    {contactResults.map((contact) => (
                      <li
                        key={contact.id}
                        onClick={() => handleSelectContact(contact)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-whatsapp-50 cursor-pointer transition-colors group"
                      >
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                          {(contact.name || contact.phone).charAt(0).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {contact.name || 'Tanpa Nama'}
                          </p>
                          <p className="text-xs text-gray-500 font-mono truncate">{contact.phone}</p>
                        </div>
                        {/* Arrow indicator */}
                        <span className="text-whatsapp-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">Pilih →</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hint when no session selected */}
              {!formData.sessionId && (
                <p className="text-xs text-amber-600 mt-1">⚠️ Pilih WhatsApp Session terlebih dahulu untuk menggunakan pencarian kontak.</p>
              )}
              {formData.sessionId && !selectedContactName && (
                <p className="text-xs text-gray-400 mt-1">💡 Ketik minimal 2 karakter untuk cari dari kontak tersimpan, atau langsung masukkan nomor (contoh: 6281234567890)</p>
              )}
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
