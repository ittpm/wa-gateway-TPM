import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Plus,
  Trash2,
  RefreshCw,
  QrCode,
  Smartphone,
  PowerOff,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  X,
  KeyRound,
  RotateCw
} from 'lucide-react'
import { api } from '../services/api'
import QRModal from '../components/QRModal'
import ConfirmModal from '../components/ConfirmModal'

function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(null)
  const [showDelete, setShowDelete] = useState(null)
  const [newSessionName, setNewSessionName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [showToken, setShowToken] = useState(null)
  const qrIntervalRef = useRef(null)

  // Contacts state
  const [showContacts, setShowContacts] = useState(null)
  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsSearch, setContactsSearch] = useState('')

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 5000)
    return () => {
      clearInterval(interval)
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
    }
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await api.get('/sessions')
      setSessions(response.data)
    } catch (error) {
      toast.error('Gagal mengambil data session')
    } finally {
      setLoading(false)
    }
  }

  const createSession = async (e) => {
    e.preventDefault()
    if (!newSessionName.trim()) return

    try {
      const response = await api.post('/sessions', { name: newSessionName })
      toast.success('Session dibuat! API Key tersedia untuk integrasi.')

      setShowToken({
        id: response.data.id,
        name: newSessionName,
        token: response.data.token,
        apiKey: response.data.apiKey
      })

      setNewSessionName('')
      setShowCreateForm(false)
      fetchSessions()

      setTimeout(() => {
        setShowQR({
          sessionId: response.data.id,
          qrCode: null,
          token: response.data.token
        })
        startQRRefresh(response.data.id)
      }, 1000)

    } catch (error) {
      toast.error('Gagal membuat session')
    }
  }

  const startQRRefresh = (sessionId) => {
    // Clear existing interval
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)

    // Reset QR display first
    setShowQR(prev => prev ? { ...prev, qrCode: null, status: 'connecting' } : null)

    // Fetch QR immediately first time
    api.get(`/sessions/${sessionId}/qr`).then(response => {
      if (response.data.qrCode && response.data.qrCode.startsWith('data:image')) {
        setShowQR(prev => prev ? {
          ...prev,
          qrCode: response.data.qrCode,
          status: response.data.status,
          updatedAt: response.data.updatedAt
        } : null)
      }
    }).catch(err => console.error('Initial QR fetch error:', err))

    // Start auto-refresh QR (setiap 2 detik untuk lebih responsif)
    qrIntervalRef.current = setInterval(async () => {
      try {
        const response = await api.get(`/sessions/${sessionId}/qr`)

        if (response.data.qrCode && response.data.qrCode.startsWith('data:image')) {
          setShowQR(prev => {
            if (!prev) return null
            return {
              ...prev,
              qrCode: response.data.qrCode,
              status: response.data.status,
              updatedAt: response.data.updatedAt
            }
          })
        }

        // Update status even if QR is not ready yet
        if (response.data.status) {
          setShowQR(prev => {
            if (!prev) return null
            return { ...prev, status: response.data.status }
          })
        }

        // Check if connected
        if (response.data.status === 'connected') {
          clearInterval(qrIntervalRef.current)
          qrIntervalRef.current = null
          setTimeout(() => {
            setShowQR(null)
            toast.success('WhatsApp berhasil terhubung!')
            fetchSessions()
          }, 2000)
        }
      } catch (error) {
        console.error('QR refresh error:', error)
      }
    }, 2000)
  }

  const deleteSession = async (id) => {
    try {
      await api.delete(`/sessions/${id}`)
      toast.success('Session dihapus')
      setShowDelete(null)
      fetchSessions()
    } catch (error) {
      toast.error('Gagal menghapus session')
    }
  }

  const reconnectSession = async (id) => {
    try {
      await api.post(`/sessions/${id}/reconnect`)
      toast.success('Menghubungkan ulang...')

      // Show QR modal
      setShowQR({ sessionId: id, qrCode: null })
      startQRRefresh(id)

      fetchSessions()
    } catch (error) {
      toast.error('Gagal reconnect')
    }
  }

  const logoutSession = async (id) => {
    try {
      await api.post(`/sessions/${id}/logout`)
      toast.success('Session logout')
      fetchSessions()
    } catch (error) {
      toast.error('Gagal logout')
    }
  }

  const refreshStatus = async (id) => {
    try {
      toast.loading('Mengecek status...')
      const response = await api.post(`/sessions/${id}/refresh`)
      toast.dismiss()

      if (response.data.isConnected) {
        toast.success(`Session terhubung ke ${response.data.status}`)
      } else {
        toast.error(`Session tidak terhubung: ${response.data.reason || 'unknown'}`)
      }
      fetchSessions()
    } catch (error) {
      toast.dismiss()
      toast.error('Gagal refresh status: ' + (error.response?.data?.error || error.message))
    }
  }

  const copyApiKey = (apiKey) => {
    navigator.clipboard.writeText(apiKey)
    toast.success('API Key disalin ke clipboard!')
  }

  const regenerateApiKey = async (sessionId) => {
    try {
      const response = await api.post(`/sessions/${sessionId}/regenerate-key`)
      toast.success('API Key berhasil di-generate ulang!')
      // Update sessions list locally
      fetchSessions()
      return response.data.apiKey
    } catch (error) {
      toast.error('Gagal generate ulang API Key')
    }
  }

  const copyToken = (token) => {
    navigator.clipboard.writeText(token)
    toast.success('Token disalin ke clipboard!')
  }

  const copyCodeExample = (sessionId, token) => {
    const code = `# Contoh penggunaan API
curl -X POST http://localhost:8080/api/v1/messages/send \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${token}" \\
  -d '{
    "sessionId": "${sessionId}",
    "to": "6281234567890",
    "type": "text",
    "message": "Hello World!"
  }'`
    navigator.clipboard.writeText(code)
    toast.success('Contoh kode disalin!')
  }

  const fetchContacts = async (sessionId, search = '') => {
    setContactsLoading(true)
    try {
      const response = await api.get(`/sessions/${sessionId}/contacts?search=${search}`)
      setContacts(response.data.contacts)
    } catch (error) {
      toast.error('Gagal mengambil daftar kontak')
    } finally {
      setContactsLoading(false)
    }
  }

  const openContactsModal = (session) => {
    setShowContacts(session)
    setContactsSearch('')
    fetchContacts(session.id)
  }

  const handleSearchContacts = (e) => {
    e.preventDefault()
    if (showContacts) {
      fetchContacts(showContacts.id, contactsSearch)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      connected: 'bg-green-100 text-green-800 border-green-200',
      disconnected: 'bg-red-100 text-red-800 border-red-200',
      connecting: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      qr: 'bg-blue-100 text-blue-800 border-blue-200',
    }
    const icons = {
      connected: CheckCircle,
      disconnected: XCircle,
      connecting: Clock,
      qr: QrCode
    }
    const labels = {
      connected: 'Terhubung',
      disconnected: 'Terputus',
      connecting: 'Menghubungkan',
      qr: 'Scan QR'
    }
    const Icon = icons[status] || Clock
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.disconnected}`}>
        <Icon className="w-3 h-3" />
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
          <p className="text-gray-500">Kelola koneksi WhatsApp Anda</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Session Baru
        </button>
      </div>

      {/* Token Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">🔑 Integrasi API</h3>
        <p className="text-sm text-blue-700">
          Setiap session memiliki token unik untuk integrasi dengan aplikasi lain.
          Token dapat digunakan di header <code>X-API-Key</code> saat mengirim pesan via API.
        </p>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Buat Session Baru</h3>
          <form onSubmit={createSession} className="flex gap-4">
            <input
              type="text"
              placeholder="Nama session (contoh: Akun Bisnis 1)"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              className="input-field flex-1"
              autoFocus
            />
            <button type="submit" className="btn-primary">
              Buat
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="btn-secondary"
            >
              Batal
            </button>
          </form>
        </div>
      )}

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-48">
              <div className="h-12 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))
        ) : sessions.length === 0 ? (
          <div className="col-span-full card text-center py-12">
            <Smartphone className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada session</h3>
            <p className="text-gray-500 mb-4">Buat session WhatsApp pertama Anda</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary inline-flex"
            >
              <Plus className="w-5 h-5" />
              Buat Session
            </button>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${session.status === 'connected' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                    <Smartphone className={`w-6 h-6 ${session.status === 'connected' ? 'text-green-600' : 'text-gray-400'
                      }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{session.name}</h3>
                    {getStatusBadge(session.status)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Nomor:</span>
                  <span className="font-medium text-gray-900">{session.phone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pesan Terkirim:</span>
                  <span className="font-medium text-gray-900">{session.messageCount?.toLocaleString() || 0}</span>
                </div>
                {session.token && (
                  <div className="flex justify-between items-center">
                    <span>Token:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {session.token.substring(0, 15)}...
                      </code>
                      <button
                        onClick={() => copyToken(session.token)}
                        className="text-whatsapp-600 hover:text-whatsapp-700"
                        title="Salin token"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {/* API Key Section */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-whatsapp-600" />
                      API Key
                    </span>
                    <button
                      onClick={() => regenerateApiKey(session.id)}
                      className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-1"
                      title="Generate ulang API Key"
                    >
                      <RotateCw className="w-3 h-3" />
                      Regenerate
                    </button>
                  </div>
                  {session.apiKey ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-100 px-2 py-1.5 rounded text-xs font-mono text-gray-700 truncate">
                        {session.apiKey.substring(0, 22)}...
                      </code>
                      <button
                        onClick={() => copyApiKey(session.apiKey)}
                        className="shrink-0 text-whatsapp-600 hover:text-whatsapp-700 p-1 hover:bg-whatsapp-50 rounded"
                        title="Salin API Key"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">API Key belum tersedia, coba refresh halaman.</p>
                  )}
                </div>

                <div className="flex justify-between">
                  <span>Terakhir Aktif:</span>
                  <span className="font-medium text-gray-900">
                    {session.lastActive ? new Date(session.lastActive).toLocaleString('id-ID') : '-'}
                  </span>
                </div>
                {session.browser && (
                  <div className="flex justify-between">
                    <span>Browser:</span>
                    <span className="font-medium text-gray-900">{session.browser}</span>
                  </div>
                )}
                {(session.deviceInfo || session.platform) && (
                  <div className="flex justify-between">
                    <span>Device:</span>
                    <span className="font-medium text-gray-900">
                      {session.platform || 'WhatsApp'}
                      {session.deviceInfo ? ` (${session.deviceInfo})` : ''}
                    </span>
                  </div>
                )}
                {session.meName && (
                  <div className="flex justify-between">
                    <span>Nama Akun:</span>
                    <span className="font-medium text-gray-900">{session.meName}</span>
                  </div>
                )}
                {session.status === 'connected' && (
                  <div className="flex justify-between items-center">
                    <span>Kontak:</span>
                    <div className="flex items-center gap-2">
                      {session.contactsSyncStatus === 'syncing' ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                          <span className="text-sm text-blue-600">Menyinkron...</span>
                        </>
                      ) : session.contactsSyncStatus === 'completed' ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-gray-900">{session.contactsCount || 0} kontak</span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">Menunggu pesan...</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {session.status === 'disconnected' && (
                  <button
                    onClick={() => reconnectSession(session.id)}
                    className="btn-primary text-sm py-1.5"
                  >
                    <QrCode className="w-4 h-4" />
                    Scan QR
                  </button>
                )}
                {session.status === 'qr' && (
                  <button
                    onClick={() => {
                      setShowQR({ sessionId: session.id, qrCode: null, token: session.token })
                      startQRRefresh(session.id)
                    }}
                    className="btn-primary text-sm py-1.5"
                  >
                    <QrCode className="w-4 h-4" />
                    Lihat QR
                  </button>
                )}
                {session.token && (
                  <button
                    onClick={() => copyCodeExample(session.id, session.token)}
                    className="btn-secondary text-sm py-1.5"
                    title="Salin contoh kode API"
                  >
                    <Copy className="w-4 h-4" />
                    API Code
                  </button>
                )}
                {session.status === 'connected' && (
                  <button
                    onClick={() => openContactsModal(session)}
                    className="btn-secondary text-sm py-1.5"
                    title="Lihat kontak dari WhatsApp"
                  >
                    <Users className="w-4 h-4" />
                    Kontak
                  </button>
                )}
                {session.status === 'connected' && (
                  <button
                    onClick={() => logoutSession(session.id)}
                    className="btn-secondary text-sm py-1.5"
                  >
                    <PowerOff className="w-4 h-4" />
                    Logout
                  </button>
                )}

                {/* Refresh Status Button - tampil untuk semua status */}
                <button
                  onClick={() => refreshStatus(session.id)}
                  className="btn-secondary text-sm py-1.5"
                  title="Refresh status dari WhatsApp"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowDelete(session)}
                  className="btn-danger text-sm py-1.5 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* QR Modal */}
      {showQR && (
        <QRModal
          qrCode={showQR.qrCode}
          token={showQR.token}
          status={showQR.status}
          updatedAt={showQR.updatedAt}
          onClose={() => {
            if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
            setShowQR(null)
          }}
        />
      )}

      {/* Token Modal */}
      {showToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Session Dibuat!</h2>
              <button
                onClick={() => setShowToken(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-800 text-sm">
                  ✅ Session <strong>{showToken.name}</strong> berhasil dibuat!
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key (gunakan sebagai X-API-Key)
                </label>
                {showToken.apiKey ? (
                  <div className="flex gap-2">
                    <code className="flex-1 bg-gray-100 p-3 rounded-lg text-xs break-all font-mono">
                      {showToken.apiKey}
                    </code>
                    <button
                      onClick={() => copyApiKey(showToken.apiKey)}
                      className="btn-primary"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API Token (simpan dengan aman)</label>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-gray-100 p-3 rounded-lg text-xs break-all">
                        {showToken.token}
                      </code>
                      <button onClick={() => copyToken(showToken.token)} className="btn-primary">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">Cara Penggunaan:</p>
                <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto">{`curl -X POST http://SERVER:8080/api/v1/messages/send \\
  -H "X-API-Key: ${showToken.apiKey || showToken.token}" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"628xxx","type":"text","message":"Halo!"}'`}</pre>
              </div>

              <button
                onClick={() => {
                  setShowToken(null)
                }}
                className="btn-primary w-full"
              >
                OK, Lanjutkan ke QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts Modal */}
      {showContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Kontak WhatsApp</h2>
                <p className="text-sm text-gray-500">{showContacts.name}</p>
              </div>
              <button
                onClick={() => setShowContacts(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <form onSubmit={handleSearchContacts} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contactsSearch}
                  onChange={(e) => setContactsSearch(e.target.value)}
                  placeholder="Cari kontak..."
                  className="input-field flex-1"
                />
                <button type="submit" className="btn-secondary">
                  Cari
                </button>
              </div>
            </form>

            {/* Contacts List */}
            {/* Info */}
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-blue-800">
                💡 Kontak otomatis tersimpan saat ada pesan masuk atau grup yang diikuti.
                Total: <strong>{contacts.length}</strong> kontak
              </p>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {contactsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Belum ada kontak tersimpan</p>
                  <p className="text-sm mt-2">
                    Kontak akan otomatis muncul saat:
                  </p>
                  <ul className="text-sm text-left mt-2 space-y-1 bg-gray-50 p-3 rounded-lg">
                    <li>• Ada pesan masuk ke WhatsApp Anda</li>
                    <li>• Anda mengirim pesan ke nomor baru</li>
                    <li>• Ada aktivitas di grup yang Anda ikuti</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-whatsapp-100 rounded-full flex items-center justify-center">
                        <span className="text-whatsapp-600 font-medium">
                          {(contact.name || contact.phone).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {contact.name || contact.phone}
                        </p>
                        <p className="text-sm text-gray-500">{contact.phone}</p>
                      </div>
                      {contact.isGroup && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Grup
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t text-center text-sm text-gray-500">
              Total: {contacts.length} kontak
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <ConfirmModal
          title="Hapus Session"
          message={`Anda yakin ingin menghapus "${showDelete.name}"? Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => deleteSession(showDelete.id)}
          onCancel={() => setShowDelete(null)}
          confirmText="Hapus"
          danger
        />
      )}
    </div>
  )
}

export default Sessions
