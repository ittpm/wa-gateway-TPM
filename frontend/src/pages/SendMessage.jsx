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
  X,
  Upload,
  Download
} from 'lucide-react'
import * as XLSX from 'xlsx'
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

  // Bulk Excel Upload states
  const [excelData, setExcelData] = useState([])
  const [excelFileName, setExcelFileName] = useState('')
  const fileInputRef = useRef(null)

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
      const connectedSessions = response.data.filter(s => s.status === 'connected')
      setSessions(connectedSessions)

      if (connectedSessions.length > 0 && !formData.sessionId) {
        setFormData(prev => ({ ...prev, sessionId: connectedSessions[0].id }))
      }
    } catch (error) {
      toast.error('Failed to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleOpenContactModal = async () => {
    if (!formData.sessionId) {
      toast.error('Please select a WhatsApp session first')
      return
    }
    setIsContactModalOpen(true)
    const currentNumbers = formData.to.split(',').map(n => n.trim()).filter(Boolean)
    setSelectedContacts(new Set(currentNumbers))

    if (allContacts.length === 0) {
      setContactLoading(true)
      try {
        const res = await api.get(`/sessions/${formData.sessionId}/contacts`)
        const contacts = (res.data?.contacts || []).filter(c => !c.isGroup)
        setAllContacts(contacts)
      } catch (error) {
        toast.error('Failed to load contacts')
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

  // === Excel Handling Functions ===
  const downloadExcelTemplate = () => {
    const ws_data = [
      ['No HP', 'Pesan', 'Url Media (Opsional)', 'Nama File (Opsional)', 'Tipe Pesan (text/image/document)'],
      ['628123456789', 'Halo ini pesan tes excel', '', '', 'text'],
      ['628987654321', 'Katalog terbaru kami', 'https://example.com/katalog.pdf', 'Katalog.pdf', 'document'],
      ['628111222333', 'Promosi hari ini', 'https://example.com/promo.jpg', '', 'image']
    ]
    const ws = XLSX.utils.aoa_to_sheet(ws_data)
    
    // Auto-size columns
    const wscols = [{wch:15}, {wch:30}, {wch:30}, {wch:20}, {wch:25}]
    ws['!cols'] = wscols
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Template")
    XLSX.writeFile(wb, "WaGateway_BulkTemplate.xlsx")
  }

  const handleExcelUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setExcelFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
        
        // Skip header row
        const rows = data.slice(1).filter(row => row.length > 0 && row[0])
        
        const parsedData = rows.map(row => {
          // Bersihkan nomor HP
          let phone = String(row[0] || '').replace(/[^0-9]/g, '')
          // Default tipe pesan 'text' jika kosong
          let type = String(row[4] || 'text').toLowerCase().trim()
          if (!['text', 'image', 'document'].includes(type)) type = 'text'

          return {
            to: phone,
            message: row[1] || '',
            mediaUrl: row[2] || '',
            fileName: row[3] || '',
            type: type
          }
        }).filter(item => item.to.length >= 8) // Hanya ambil nomor valid
        
        setExcelData(parsedData)
        toast.success(`Berhasil memuat ${parsedData.length} data dari Excel`)
      } catch (err) {
        toast.error('Gagal membaca file Excel. Pastikan format sesuai template.')
        console.error(err)
      }
    }
    reader.readAsBinaryString(file)
  }

  const clearExcelData = () => {
    setExcelData([])
    setExcelFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const tabs = [
    { id: 'text', label: 'Text', icon: MessageSquare },
    { id: 'media', label: 'Media', icon: Image },
    { id: 'document', label: 'Document', icon: FileText },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'contact', label: 'Contact', icon: User },
    { id: 'bulk', label: 'Bulk Send (Excel)', icon: Users },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.sessionId) {
      toast.error('Please select a WhatsApp session first')
      return
    }

    setLoading(true)

    try {
      // HANDLE BULK EXCEL SEND
      if (activeTab === 'bulk') {
        if (excelData.length === 0) {
          toast.error('Data excel masih kosong. Silakan upload file terlebih dahulu.')
          setLoading(false)
          return
        }

        let successCount = 0
        let queuedCount = 0

        // Karena format bulk bisa berbeda (ada media, document, text per baris), 
        // kita akan loop pengirimannya untuk memanfaatkan endpoint normal 
        // atau jika API mendukung bulk dinamis, Anda bisa memodifikasi payload.
        // Di sini kita loop ke /messages/send
        for (const item of excelData) {
          const payload = {
            sessionId: formData.sessionId,
            to: item.to,
            type: item.type,
            content: item.message,
            mediaUrl: item.mediaUrl,
            fileName: item.fileName,
            caption: item.type === 'image' || item.type === 'document' ? item.message : '',
            delay: formData.delay,
            scheduledAt: formData.scheduledAt
          }

          try {
            await api.post('/messages/send', payload)
            if (formData.delay || formData.scheduledAt) queuedCount++
            else successCount++
          } catch (err) {
            console.error(`Failed to send bulk item to ${item.to}:`, err)
          }
        }

        toast.success(`Berhasil diproses! ${successCount} Terkirim langsung, ${queuedCount} Masuk Antrean.`)
        clearExcelData()
        setLoading(false)
        return
      }

      // HANDLE NORMAL SEND (TEXT/MEDIA/DOCUMENT/LOCATION)
      let endpoint = '/messages/send'
      let payload = { ...formData }

      const recipients = formData.to.split(',')
      const validRecipients = recipients
        .map(n => n.trim().replace(/[^0-9]/g, ''))
        .filter(n => n.length > 5)

      if (validRecipients.length === 0) {
        toast.error('Silakan isi nomor tujuan yang valid')
        setLoading(false)
        return
      }

      // Upload file logic
      if ((activeTab === 'media' || activeTab === 'document') && selectedFile) {
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
              await api.post('/messages/upload-scheduled', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
              successCount++
            } catch (err) {}
          }

          if (successCount > 0) toast.success(`File dijadwalkan untuk ${successCount} nomor!`)
          setFormData(prev => ({ ...prev, to: '', caption: '', scheduledAt: '' }))
          setSelectedFile(null)
          setLoading(false)
          return
        }

        let successCount = 0;
        for (const recipient of validRecipients) {
          const formDataUpload = new FormData()
          formDataUpload.append('sessionId', formData.sessionId)
          formDataUpload.append('to', recipient)
          formDataUpload.append('caption', formData.caption || '')
          formDataUpload.append('file', selectedFile)

          try {
            await api.post('/messages/send-media', formDataUpload, { headers: { 'Content-Type': 'multipart/form-data' } })
            successCount++
          } catch (err) {}
        }

        if (successCount > 0) toast.success(formData.delay ? `Files queued for ${successCount} numbers!` : `Files sent to ${successCount} numbers!`)
        setFormData(prev => ({ ...prev, to: '', caption: '' }))
        setSelectedFile(null)
        setLoading(false)
        return
      }

      switch (activeTab) {
        case 'text': payload.type = 'text'; break
        case 'media': payload.type = 'image'; break
        case 'document': payload.type = 'document'; break
        case 'location': payload.type = 'location'; break
        case 'contact': payload.type = 'vcard'; break
        default: payload.type = 'text'
      }

      let successCount = 0;
      for (const recipient of validRecipients) {
        try {
          await api.post(endpoint, { ...payload, to: recipient })
          successCount++
        } catch (err) {}
      }
      if (successCount > 0) {
        toast.success(formData.delay ? `Messages queued for ${successCount} numbers!` : `Messages sent to ${successCount} numbers!`)
      }

      setFormData(prev => ({ ...prev, to: '', message: '', mediaUrl: '', fileName: '', caption: '' }))
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
          </div>
        )

      case 'media':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image/Video</label>
              <FileUpload onFileSelect={setSelectedFile} accept="image/*,video/*" maxSize={5 * 1024 * 1024} />
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
                className="input-field resize-none"
              />
            </div>
          </div>
        )

      case 'document':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Document</label>
              <FileUpload onFileSelect={setSelectedFile} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" maxSize={5 * 1024 * 1024} />
            </div>
            <div className="text-center text-sm text-gray-500">or</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document URL</label>
              <input
                type="url"
                value={formData.mediaUrl}
                onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
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
                <input type="number" step="any" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input type="number" step="any" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} className="input-field" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
              <input type="text" value={formData.caption} onChange={(e) => setFormData({ ...formData, caption: e.target.value })} className="input-field" />
            </div>
          </div>
        )

      case 'contact':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input type="text" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} className="input-field" required />
            </div>
          </div>
        )

      case 'bulk':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Users className="w-5 h-5" /> Panduan Bulk Send Excel
              </h3>
              <p className="text-sm text-blue-800 mb-3">
                Kirim pesan massal dengan mudah. Anda bisa mengirim teks, gambar, maupun dokumen secara spesifik ke setiap nomor menggunakan file Excel (.xlsx).
              </p>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={downloadExcelTemplate}
                  className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download Template Excel
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Data Excel</label>
              
              {!excelFileName ? (
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">Klik untuk memilih file .xlsx atau .csv</p>
                  <p className="text-xs text-gray-500 mt-1">Gunakan format sesuai template di atas</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleExcelUpload} 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                  />
                </div>
              ) : (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded text-green-700">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-green-900 text-sm">{excelFileName}</p>
                      <p className="text-xs text-green-700">{excelData.length} kontak siap dikirim</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={clearExcelData}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Preview Tabel */}
            {excelData.length > 0 && (
              <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-medium text-sm text-gray-700">
                  Pratinjau Data (Top 5)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 border-b">
                      <tr>
                        <th className="px-4 py-2 font-medium">No HP</th>
                        <th className="px-4 py-2 font-medium">Tipe</th>
                        <th className="px-4 py-2 font-medium">Pesan / URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {excelData.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900 font-mono text-xs">{row.to}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              row.type === 'image' ? 'bg-purple-100 text-purple-700' :
                              row.type === 'document' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600 truncate max-w-[200px]">
                            {row.type === 'text' ? row.message : row.mediaUrl || row.message}
                          </td>
                        </tr>
                      ))}
                      {excelData.length > 5 && (
                        <tr>
                          <td colSpan="3" className="px-4 py-2 text-center text-xs text-gray-500 bg-gray-50 italic">
                            ... dan {excelData.length - 5} data lainnya
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Send Message</h1>
          <p className="text-gray-500">Send single or bulk messages with anti-block protection</p>
        </div>
        <button onClick={fetchSessions} disabled={sessionsLoading} className="text-sm text-whatsapp-600 hover:text-whatsapp-700">
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.id ? 'bg-whatsapp-100 text-whatsapp-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Smartphone className="w-4 h-4 inline mr-1" /> WhatsApp Session
            </label>
            {sessionsLoading ? (
              <div className="input-field bg-gray-50 text-gray-500">Loading sessions...</div>
            ) : (
              <select value={formData.sessionId} onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })} className="input-field" required>
                <option value="">Select a session...</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>{session.name} ({session.phone || session.id.slice(0, 8)}...)</option>
                ))}
              </select>
            )}
          </div>

          {activeTab !== 'bulk' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" /> To (Recipients)
              </label>
              <div className="flex gap-2">
                <input type="text" value={formData.to} onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))} placeholder="Misal: 6281234567, 6289876543" className="input-field" required />
                <button type="button" onClick={handleOpenContactModal} disabled={!formData.sessionId} className="flex items-center justify-center px-3 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40">
                  <Users className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {renderForm()}

          <div className="flex flex-col gap-3 py-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="useDelay" checked={formData.delay} onChange={(e) => setFormData({ ...formData, delay: e.target.checked })} className="w-4 h-4 text-whatsapp-600 rounded" />
              <label htmlFor="useDelay" className="text-sm text-gray-600">Use Anti-Block Delay (Masuk Antrean)</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="useSchedule" checked={!!formData.scheduledAt} onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.checked ? new Date().toISOString().slice(0, 16) : '' })} className="w-4 h-4 text-whatsapp-600 rounded" />
              <label htmlFor="useSchedule" className="text-sm text-gray-600">Schedule Message (Kirim Terjadwal)</label>
            </div>
            {formData.scheduledAt && (
              <div className="ml-6">
                <input type="datetime-local" value={formData.scheduledAt} onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })} className="input-field max-w-xs" />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading || sessions.length === 0} className="btn-primary disabled:opacity-50 min-w-[150px] flex justify-center">
              {loading ? (
                <div className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</div>
              ) : (
                <div className="flex items-center gap-2"><Send className="w-5 h-5" /> {activeTab === 'bulk' ? 'Kirim Massal (Bulk)' : 'Kirim Pesan'}</div>
              )}
            </button>
          </div>
        </form>
      </div >

      {/* Modal Contact */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-whatsapp-600" /> Pilih Kontak</h2>
              <button onClick={() => setIsContactModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 flex flex-col flex-1 min-h-0">
              <div className="relative mb-4 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={modalSearchQuery} onChange={(e) => setModalSearchQuery(e.target.value)} placeholder="Cari nama atau nomor..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg outline-none" autoFocus />
              </div>
              <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg bg-gray-50/30">
                <ul className="divide-y divide-gray-100">
                  {filteredContacts.map(contact => (
                    <li key={contact.id}>
                      <label className="flex items-center gap-3 px-4 py-3 hover:bg-whatsapp-50 cursor-pointer">
                        <input type="checkbox" checked={selectedContacts.has(contact.phone)} onChange={() => handleToggleContactSelection(contact.phone)} className="w-4 h-4 text-whatsapp-600" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{contact.name || 'Tanpa Nama'}</p><p className="text-xs text-gray-500">{contact.phone}</p></div>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex items-center justify-between shrink-0">
              <div className="text-sm font-medium text-gray-600"><span className="text-whatsapp-600 font-bold">{selectedContacts.size}</span> kontak dipilih</div>
              <div className="flex gap-2">
                <button onClick={() => setIsContactModalOpen(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Batal</button>
                <button onClick={handleApplyContacts} className="px-4 py-2 text-sm text-white bg-whatsapp-500 rounded-lg">Terapkan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  )
}

export default SendMessage