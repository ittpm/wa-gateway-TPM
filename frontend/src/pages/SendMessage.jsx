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

  // Contact picker Checklist states
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [allContacts, setAllContacts] = useState([])
  const [modalSearchQuery, setModalSearchQuery] = useState('')
  const [contactLoading, setContactLoading] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState(new Set())

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

  // Fetch all contacts for checklist modal
  const handleOpenContactModal = async () => {
    if (!formData.sessionId) {
      toast.error('Please select a WhatsApp session first')
      return
    }
    setIsContactModalOpen(true)

    // Convert current comma-separated `to` field into the selected set
    const currentNumbers = formData.to.split(',').map(n => n.trim()).filter(Boolean)
    setSelectedContacts(new Set(currentNumbers))

    // Fetch contacts if not loaded yet
    if (allContacts.length === 0) {
      setContactLoading(true)
      try {
        const res = await api.get(`/sessions/${formData.sessionId}/contacts`)
        const contacts = (res.data?.contacts || []).filter(c => !c.isGroup)
        setAllContacts(contacts)
      } catch (error) {
        toast.error('Failed to load contacts')
        setAllContacts([])
      } finally {
        setContactLoading(false)
      }
    }
  }

  const handleToggleContactSelection = (phone) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(phone)) {
        newSet.delete(phone)
      } else {
        newSet.add(phone)
      }
      return newSet
    })
  }

  const handleApplyContacts = () => {
    const numbers = Array.from(selectedContacts).join(', ')
    setFormData(prev => ({ ...prev, to: numbers }))
    setIsContactModalOpen(false)
  }

  const filteredContacts = allContacts.filter(contact => {
    const query = modalSearchQuery.toLowerCase()
    return (
      (contact.name?.toLowerCase() || '').includes(query) ||
      (contact.phone?.toLowerCase() || '').includes(query)
    )
  })

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

      // Support sending to multiple numbers by looping through comma-separated 'to' values
      const recipients = activeTab === 'bulk' ? formData.to.split('\n') : formData.to.split(',')
      const validRecipients = recipients
        .map(n => n.trim().replace(/[^0-9]/g, ''))
        .filter(n => n.length > 5)

      if (validRecipients.length === 0) {
        toast.error('Silakan isi nomor tujuan yang valid')
        setLoading(false)
        return
      }

      // Check if we need to upload file
      if ((activeTab === 'media' || activeTab === 'document') && selectedFile) {

        // Jika ada schedule + file → pakai endpoint upload-scheduled
        if (formData.scheduledAt) {
          const scheduledDate = new Date(formData.scheduledAt)
          if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
            toast.error('Waktu jadwal harus di masa depan')
            setLoading(false)
            return
          }

          let successCount = 0
          for (const recipient of validRecipients) {
            const fd = new FormData()
            fd.append('sessionId', formData.sessionId)
            fd.append('to', recipient)
            fd.append('caption', formData.caption || '')
            fd.append('scheduledAt', scheduledDate.toISOString())
            fd.append('file', selectedFile)
            try {
              await api.post('/messages/upload-scheduled', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
              })
              successCount++
            } catch (err) {
              console.error(`Failed to schedule media to ${recipient}:`, err)
            }
          }

          if (successCount > 0) {
            toast.success(`File dijadwalkan untuk ${successCount} nomor!`)
          } else {
            toast.error('Gagal menjadwalkan file ke penerima')
          }
          setFormData(prev => ({ ...prev, to: '', caption: '', scheduledAt: '' }))
          setSelectedFile(null)
          setLoading(false)
          return
        }

        // Kirim langsung (tanpa schedule) → pakai send-media
        let successCount = 0;
        for (const recipient of validRecipients) {
          const formDataUpload = new FormData()
          formDataUpload.append('sessionId', formData.sessionId)
          formDataUpload.append('to', recipient)
          formDataUpload.append('caption', formData.caption || '')
          formDataUpload.append('file', selectedFile)

          try {
            await api.post('/messages/send-media', formDataUpload, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
            successCount++
          } catch (err) {
            console.error(`Failed to send media to ${recipient}:`, err)
          }
        }

        if (successCount > 0) {
          toast.success(formData.delay ? `Files uploaded & queued for ${successCount} numbers!` : `Files sent to ${successCount} numbers!`)
        } else {
          toast.error('Failed to send file to recipients')
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
          payload.recipients = validRecipients // bulk takes array
          break
        default:
          payload.type = 'text'
      }

      if (activeTab === 'bulk') {
        const response = await api.post(endpoint, payload)
        toast.success(`Bulk message queued for ${validRecipients.length} recipients!`)
      } else {
        // Loop individual API calls for text/location/etc if multiple numbers
        let successCount = 0;
        for (const recipient of validRecipients) {
          try {
            await api.post(endpoint, { ...payload, to: recipient })
            successCount++
          } catch (err) {
            console.error(`Failed to send to ${recipient}:`, err)
          }
        }
        if (successCount > 0) {
          toast.success(formData.delay ? `Messages queued for ${successCount} numbers!` : `Messages sent to ${successCount} numbers!`)
        } else {
          toast.error('Failed to send messages')
        }
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
            {selectedFile && formData.scheduledAt ? (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <span>✅</span>
                <span>File upload + Schedule aktif — file akan disimpan di server dan dikirim tepat pada waktunya.</span>
              </div>
            ) : selectedFile ? (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <span>ℹ️</span>
                <span>File akan dikirim langsung. Centang <strong>Schedule Message</strong> di bawah untuk menjadwalkan pengiriman beserta file ini.</span>
              </div>
            ) : formData.mediaUrl ? (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <span>✅</span>
                <span>Mode URL aktif — Anda bisa aktifkan <strong>Schedule Message</strong> di bawah untuk menjadwalkan pesan ini.</span>
              </div>
            ) : null}
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
            {selectedFile && formData.scheduledAt ? (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <span>✅</span>
                <span>File upload + Schedule aktif — file akan disimpan di server dan dikirim tepat pada waktunya.</span>
              </div>
            ) : selectedFile ? (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <span>ℹ️</span>
                <span>File akan dikirim langsung. Centang <strong>Schedule Message</strong> di bawah untuk menjadwalkan pengiriman beserta file ini.</span>
              </div>
            ) : formData.mediaUrl ? (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <span>✅</span>
                <span>Mode URL aktif — Anda bisa aktifkan <strong>Schedule Message</strong> di bawah untuk menjadwalkan pesan ini.</span>
              </div>
            ) : null}
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

          {/* Common Fields - To Field */}
          {activeTab !== 'bulk' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                To (Recipients: nomor dipisah koma)
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.to}
                  onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
                  placeholder="Misal: 6281234567, 6289876543 (boleh banyak nomor)"
                  className="input-field"
                  required
                />

                <button
                  type="button"
                  onClick={handleOpenContactModal}
                  disabled={!formData.sessionId}
                  className="flex items-center justify-center px-3 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 border border-green-200"
                  title="Pilih dari Kontak"
                >
                  <Users className="w-5 h-5" />
                </button>
              </div>
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
      </div >

      {/* Contact Checklist Modal */}
      {
        isContactModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-whatsapp-600" />
                  Pilih Kontak
                </h2>
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 flex flex-col flex-1 min-h-0">
                {/* Local Search Input */}
                <div className="relative mb-4 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    placeholder="Cari nama atau nomor di sini..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-whatsapp-500/20 focus:border-whatsapp-500 transition-all text-sm outline-none"
                    autoFocus
                  />
                </div>

                {/* Contact List */}
                <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg bg-gray-50/30">
                  {contactLoading ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                      <div className="w-8 h-8 border-3 border-whatsapp-500/30 border-t-whatsapp-500 rounded-full animate-spin mb-3" />
                      <p className="text-sm font-medium">Memuat kontak...</p>
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                      <Users className="w-10 h-10 mb-3 text-gray-300" />
                      <p className="text-sm">Tidak ada kontak ditemukan</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {filteredContacts.map(contact => (
                        <li key={contact.id}>
                          <label className="flex items-center gap-3 px-4 py-3 hover:bg-whatsapp-50 cursor-pointer transition-colors group">
                            <input
                              type="checkbox"
                              checked={selectedContacts.has(contact.phone)}
                              onChange={() => handleToggleContactSelection(contact.phone)}
                              className="w-4 h-4 text-whatsapp-600 rounded border-gray-300 focus:ring-whatsapp-500 cursor-pointer"
                            />
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm opacity-90 group-hover:opacity-100`}>
                              {(contact.name || contact.phone).charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {contact.name || 'Tanpa Nama'}
                              </p>
                              <p className="text-xs text-gray-500 font-mono truncate">{contact.phone}</p>
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
                <div className="text-sm font-medium text-gray-600">
                  <span className="text-whatsapp-600 font-bold">{selectedContacts.size}</span> kontak dipilih
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsContactModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyContacts}
                    className="px-4 py-2 text-sm font-medium text-white bg-whatsapp-500 hover:bg-whatsapp-600 rounded-lg shadow-sm shadow-whatsapp-500/20 transition-all font-semibold"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}

export default SendMessage
