import { useEffect, useState } from 'react'
import {
  Smartphone,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity
} from 'lucide-react'
import { api } from '../services/api'
import StatsCard from '../components/StatsCard'
import ActivityChart from '../components/ActivityChart'
import RecentSessions from '../components/RecentSessions'

function Dashboard() {
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    messagesSent: 0,
    messagesQueued: 0,
    messagesDelivered: 0,
    messagesFailed: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Gagal mengambil statistik:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Session Aktif',
      value: stats.activeSessions,
      total: stats.totalSessions,
      icon: Smartphone,
      color: 'blue',
      subtitle: 'dari total session'
    },
    {
      title: 'Pesan Terkirim',
      value: stats.messagesSent,
      icon: Send,
      color: 'green',
      subtitle: 'total pengiriman'
    },
    {
      title: 'Dalam Antrean',
      value: stats.messagesQueued,
      icon: Clock,
      color: 'yellow',
      subtitle: 'menunggu dikirim'
    },
    {
      title: 'Berhasil Dikirim',
      value: stats.messagesDelivered,
      icon: CheckCircle,
      color: 'whatsapp',
      subtitle: 'terkirim sukses'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Ringkasan sistem WhatsApp Gateway Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <Activity className="w-4 h-4" />
            Sistem Online
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatsCard key={card.title} {...card} loading={loading} />
        ))}
      </div>

      {/* Charts & Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityChart />
        </div>
        <div>
          <RecentSessions />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a href="/sessions" className="p-4 border border-gray-200 rounded-lg hover:border-whatsapp-500 hover:bg-whatsapp-50 transition-all group">
            <Smartphone className="w-8 h-8 text-whatsapp-600 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-gray-900">Kelola Session</h3>
            <p className="text-sm text-gray-500 mt-1">Tambah atau kelola akun WhatsApp</p>
          </a>
          <a href="/send" className="p-4 border border-gray-200 rounded-lg hover:border-whatsapp-500 hover:bg-whatsapp-50 transition-all group">
            <Send className="w-8 h-8 text-whatsapp-600 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-gray-900">Kirim Pesan</h3>
            <p className="text-sm text-gray-500 mt-1">Kirim text, media, atau bulk message</p>
          </a>
          <a href="/antiblock" className="p-4 border border-gray-200 rounded-lg hover:border-whatsapp-500 hover:bg-whatsapp-50 transition-all group">
            <AlertCircle className="w-8 h-8 text-whatsapp-600 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-gray-900">Pengaturan Anti-Block</h3>
            <p className="text-sm text-gray-500 mt-1">Atur rate limit dan delay</p>
          </a>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
