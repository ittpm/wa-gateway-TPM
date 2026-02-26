import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  AlertCircle
} from 'lucide-react'
import { api } from '../services/api'

function Queue() {
  const [queue, setQueue] = useState([])
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchQueue = async () => {
    try {
      const [queueRes, statsRes] = await Promise.all([
        api.get('/queue'),
        api.get('/queue/stats'),
      ])
      const q = queueRes.data
      setQueue(Array.isArray(q) ? q : Array.isArray(q?.data) ? q.data : [])
      setStats(prev => ({
        ...prev,
        ...(statsRes.data && typeof statsRes.data === 'object' ? statsRes.data : {})
      }))
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearQueue = async (status) => {
    try {
      await api.delete(`/queue?status=${status}`)
      toast.success(`Cleared ${status} messages`)
      fetchQueue()
    } catch (error) {
      toast.error('Failed to clear queue')
    }
  }

  const retryFailed = async () => {
    try {
      await api.post('/queue/retry')
      toast.success('Retrying failed messages')
      fetchQueue()
    } catch (error) {
      toast.error('Failed to retry')
    }
  }

  const togglePause = async () => {
    try {
      await api.post('/queue/pause', { paused: !isPaused })
      setIsPaused(!isPaused)
      toast.success(isPaused ? 'Queue resumed' : 'Queue paused')
    } catch (error) {
      toast.error('Failed to toggle queue')
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }
    const icons = {
      pending: Clock,
      processing: RefreshCw,
      completed: CheckCircle,
      failed: XCircle,
    }
    const Icon = icons[status] || Clock
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Queue</h1>
          <p className="text-gray-500">Manage and monitor message delivery queue</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className={isPaused ? 'btn-primary' : 'btn-secondary'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={retryFailed}
            className="btn-secondary"
            disabled={stats.failed === 0}
          >
            <RefreshCw className="w-4 h-4" />
            Retry Failed
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.processing}</p>
              <p className="text-sm text-gray-500">Processing</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              <p className="text-sm text-gray-500">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Queue Items</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => clearQueue('completed')}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              Clear Completed
            </button>
            <button
              onClick={() => clearQueue('failed')}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              Clear Failed
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                  </tr>
                ))
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Queue is empty</p>
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.to}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.type}</td>
                    <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.attempts}/3</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Queue
