import { useEffect, useState } from 'react'
import { X, RefreshCw, CheckCircle, Smartphone, Clock } from 'lucide-react'

function QRModal({ qrCode, token, onClose, status, updatedAt }) {
  const [countdown, setCountdown] = useState(30)
  const [connected, setConnected] = useState(false)
  const [dots, setDots] = useState('')
  const [showRetry, setShowRetry] = useState(false)
  const [qrAge, setQrAge] = useState(0)

  useEffect(() => {
    // Animate dots
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)

    return () => clearInterval(dotsInterval)
  }, [])

  // Reset countdown when QR code appears
  useEffect(() => {
    if (qrCode && qrCode.startsWith('data:image')) {
      setShowRetry(false)
      setCountdown(30)
    }
  }, [qrCode])

  // Update QR age timer
  useEffect(() => {
    if (!qrCode || !updatedAt) return;
    
    const interval = setInterval(() => {
      const age = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000);
      setQrAge(age);
    }, 1000);

    return () => clearInterval(interval);
  }, [qrCode, updatedAt])

  useEffect(() => {
    if (countdown > 0 && !connected && !qrCode) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && !qrCode) {
      setShowRetry(true)
    }
  }, [countdown, connected, qrCode])

  // Auto-close when connected via status prop
  useEffect(() => {
    if (status === 'connected') {
      setConnected(true)
      setTimeout(() => {
        onClose()
      }, 2000)
    }
  }, [status, onClose])

  const copyToken = () => {
    navigator.clipboard.writeText(token)
    alert('Token disalin!')
  }

  const handleRetry = () => {
    setCountdown(30)
    setShowRetry(false)
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Hubungkan WhatsApp</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {connected ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Berhasil Terhubung!</h3>
            <p className="text-gray-500">WhatsApp Anda sudah terhubung ke gateway.</p>
            <button
              onClick={onClose}
              className="btn-primary mt-6"
            >
              Tutup
            </button>
          </div>
        ) : (
          <>
            <div className="qr-container mx-auto mb-6 flex items-center justify-center bg-gray-50 min-h-[256px] rounded-lg">
              {qrCode && qrCode.startsWith('data:image') ? (
                <div className="text-center">
                  <img
                    src={qrCode}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Scan sebelum QR expired (refresh otomatis)
                  </p>
                  {updatedAt && (
                    <p className={`text-xs mt-1 flex items-center justify-center gap-1 ${qrAge > 20 ? 'text-amber-500' : 'text-gray-400'}`}>
                      <Clock className="w-3 h-3" />
                      QR diperbarui: {qrAge} detik yang lalu
                      {qrAge > 20 && ' (akan refresh segera)'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center p-8">
                  <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Memuat QR Code{dots}</p>
                  {status === 'connecting' && (
                    <p className="text-sm text-blue-500 mt-2">
                      Menghubungkan ke WhatsApp...
                    </p>
                  )}
                  {countdown > 0 && (
                    <p className="text-sm text-gray-400 mt-2">
                      Tunggu {countdown} detik
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="text-center space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Scan dengan WhatsApp</h3>
                <ol className="text-sm text-gray-500 text-left space-y-2 bg-gray-50 p-4 rounded-lg">
                  <li className="flex items-start gap-2">
                    <span className="bg-whatsapp-100 text-whatsapp-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                    Buka WhatsApp di ponsel Anda
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-whatsapp-100 text-whatsapp-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                    Ketuk Menu (⋮) → Perangkat Tertaut
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-whatsapp-100 text-whatsapp-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
                    Ketuk "Tautkan Perangkat"
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-whatsapp-100 text-whatsapp-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">4</span>
                    Arahkan kamera ke QR code ini
                  </li>
                </ol>
              </div>

              {showRetry && (
                <div className="bg-amber-50 p-3 rounded-lg">
                  <p className="text-sm text-amber-700 mb-2">
                    QR Code tidak muncul? Coba refresh halaman.
                  </p>
                  <button
                    onClick={handleRetry}
                    className="btn-primary text-sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </button>
                </div>
              )}

              {token && (
                <div className="bg-blue-50 p-3 rounded-lg text-left">
                  <p className="text-xs text-blue-700 font-medium mb-2">API Token Anda:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-white px-2 py-1 rounded text-xs break-all">
                      {token.substring(0, 20)}...
                    </code>
                    <button
                      onClick={copyToken}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Salin
                    </button>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-400 space-y-1">
                <p>QR Code akan refresh otomatis setiap 20-30 detik</p>
                {qrCode && qrCode.startsWith('data:image') && (
                  <p className="flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    QR diperbarui: {qrAge} detik yang lalu
                    {qrAge > 20 && (
                      <span className="text-amber-500"> (akan refresh segera)</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default QRModal
