import { useEffect, useState } from 'react'
import { Smartphone, CheckCircle, XCircle, Clock } from 'lucide-react'
import { api } from '../services/api'

function RecentSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await api.get('/sessions')
      // Handle berbagai format response: array langsung, atau { data: [...] }
      const rawData = response.data
      const sessionList = Array.isArray(rawData) ? rawData :
        Array.isArray(rawData?.data) ? rawData.data : []
      setSessions(sessionList.slice(0, 5))
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'disconnected':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'connecting':
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'connected':
        return 'status-connected'
      case 'disconnected':
        return 'status-disconnected'
      case 'connecting':
        return 'status-connecting'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Sessions</h2>
        <a href="/sessions" className="text-sm text-whatsapp-600 hover:underline">
          View all
        </a>
      </div>
      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Smartphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No sessions yet</p>
            <a href="/sessions" className="text-whatsapp-600 hover:underline text-sm">
              Create your first session
            </a>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-whatsapp-100 rounded-full flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-whatsapp-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{session.name}</p>
                  <p className="text-xs text-gray-500">{session.phone}</p>
                </div>
              </div>
              <span className={`status-badge ${getStatusClass(session.status)}`}>
                {session.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default RecentSessions
