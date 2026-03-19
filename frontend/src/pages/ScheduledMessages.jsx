import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
    Calendar,
    Clock,
    Trash2,
    RefreshCw,
    Image,
    FileText,
    MessageSquare,
    MapPin,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react'
import { api } from '../services/api'

function getCountdown(scheduledAt) {
    if (!scheduledAt) return null
    const now = new Date()
    const target = new Date(scheduledAt)
    const diffMs = target - now

    if (diffMs <= 0) return { text: 'Segera dikirim...', urgent: true }

    const totalSecs = Math.floor(diffMs / 1000)
    const days = Math.floor(totalSecs / 86400)
    const hours = Math.floor((totalSecs % 86400) / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60

    if (days > 0) return { text: `${days}h ${hours}j lagi`, urgent: false }
    if (hours > 0) return { text: `${hours}j ${mins}m lagi`, urgent: false }
    if (mins > 0) return { text: `${mins}m ${secs}d lagi`, urgent: mins < 5 }
    return { text: `${secs}d lagi`, urgent: true }
}

function getTypeIcon(type) {
    const icons = {
        text: MessageSquare,
        image: Image,
        video: Image,
        document: FileText,
        location: MapPin,
    }
    return icons[type] || MessageSquare
}

function getTypeBadge(type) {
    const styles = {
        text: 'bg-blue-50 text-blue-700 border-blue-200',
        image: 'bg-purple-50 text-purple-700 border-purple-200',
        video: 'bg-purple-50 text-purple-700 border-purple-200',
        document: 'bg-orange-50 text-orange-700 border-orange-200',
        location: 'bg-green-50 text-green-700 border-green-200',
    }
    const Icon = getTypeIcon(type)
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${styles[type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            <Icon className="w-3 h-3" />
            {type?.charAt(0).toUpperCase() + type?.slice(1)}
        </span>
    )
}

function CountdownBadge({ scheduledAt }) {
    const [countdown, setCountdown] = useState(() => getCountdown(scheduledAt))

    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown(getCountdown(scheduledAt))
        }, 1000)
        return () => clearInterval(interval)
    }, [scheduledAt])

    if (!countdown) return null

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${countdown.urgent
                ? 'bg-red-100 text-red-700 animate-pulse'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
            <Clock className="w-3 h-3" />
            {countdown.text}
        </span>
    )
}

function ScheduledMessages() {
    const [scheduled, setScheduled] = useState([])
    const [loading, setLoading] = useState(true)
    const [cancellingId, setCancellingId] = useState(null)

    const fetchScheduled = useCallback(async () => {
        try {
            const res = await api.get('/queue')
            const all = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : []
            const now = new Date()
            // Show messages with status 'scheduled' OR 'pending' that have a future scheduledAt
            const filtered = all.filter(item =>
                (item.status === 'scheduled' || item.status === 'pending') &&
                item.scheduledAt &&
                new Date(item.scheduledAt) > now
            )
            // Sort by scheduled time ascending
            filtered.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
            setScheduled(filtered)
        } catch (error) {
            console.error('Failed to fetch scheduled messages:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchScheduled()
        const interval = setInterval(fetchScheduled, 30000)
        return () => clearInterval(interval)
    }, [fetchScheduled])

    const handleCancel = async (item) => {
        if (!window.confirm(`Batalkan pesan terjadwal ke ${item.to}?`)) return
        setCancellingId(item.id)
        try {
            await api.delete(`/queue/${item.id}`)
            toast.success('Pesan terjadwal berhasil dibatalkan')
            setScheduled(prev => prev.filter(m => m.id !== item.id))
        } catch (error) {
            toast.error(error.response?.data?.error || 'Gagal membatalkan pesan')
        } finally {
            setCancellingId(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-whatsapp-600" />
                        Pesan Terjadwal
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {scheduled.length} pesan menunggu untuk dikirim
                    </p>
                </div>
                <button
                    onClick={fetchScheduled}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                <div>
                    <p className="font-semibold">Cara menjadwalkan pesan</p>
                    <p className="mt-1 text-blue-700">Buka menu <strong>Kirim Pesan</strong>, isi form, lalu centang <em>"Schedule Message"</em> dan pilih waktu pengiriman. Mendukung teks, gambar (via URL), dan dokumen (via URL).</p>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="card animate-pulse">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                                </div>
                                <div className="h-8 w-20 bg-gray-200 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : scheduled.length === 0 ? (
                <div className="card text-center py-16">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Tidak Ada Pesan Terjadwal</h3>
                    <p className="text-gray-400 text-sm">
                        Buat pesan terjadwal dari menu <strong>Kirim Pesan</strong>
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {scheduled.map((item) => (
                        <div
                            key={item.id}
                            className="card hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between gap-4">
                                {/* Left: info */}
                                <div className="flex-1 min-w-0 space-y-2">
                                    {/* Type + Recipient */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {getTypeBadge(item.type)}
                                        <span className="text-sm font-semibold text-gray-900 font-mono">
                                            {item.to}
                                        </span>
                                    </div>

                                    {/* Message preview */}
                                    {item.content && (
                                        <p className="text-sm text-gray-600 truncate max-w-sm">
                                            {item.content.length > 80 ? item.content.slice(0, 80) + '…' : item.content}
                                        </p>
                                    )}
                                    {item.mediaUrl && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate max-w-sm">
                                            <Image className="w-3 h-3 shrink-0" />
                                            {item.mediaUrl}
                                        </p>
                                    )}

                                    {/* Schedule time + countdown */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(item.scheduledAt).toLocaleString('id-ID', {
                                                day: '2-digit', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                        <CountdownBadge scheduledAt={item.scheduledAt} />
                                    </div>
                                </div>

                                {/* Right: Cancel button */}
                                <button
                                    onClick={() => handleCancel(item)}
                                    disabled={cancellingId === item.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors disabled:opacity-50 shrink-0"
                                >
                                    {cancellingId === item.id ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                    Batalkan
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Alert if no DELETE /queue/:id endpoint */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Halaman ini auto-refresh setiap 30 detik. Countdown update setiap detik.</span>
            </div>
        </div>
    )
}

export default ScheduledMessages
