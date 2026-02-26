import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Webhook,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  MessageSquare,
  Phone,
  Users
} from 'lucide-react'
import { api } from '../services/api'

function Webhooks() {
  const [webhooks, setWebhooks] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    secret: '',
    events: ['message.received'],
  })

  const eventOptions = [
    { value: 'message.received', label: 'Message Received', icon: MessageSquare },
    { value: 'message.sent', label: 'Message Sent', icon: MessageSquare },
    { value: 'message.delivered', label: 'Message Delivered', icon: CheckCircle },
    { value: 'message.read', label: 'Message Read', icon: CheckCircle },
    { value: 'message.failed', label: 'Message Failed', icon: XCircle },
    { value: 'session.connected', label: 'Session Connected', icon: CheckCircle },
    { value: 'session.disconnected', label: 'Session Disconnected', icon: XCircle },
    { value: 'call.received', label: 'Call Received', icon: Phone },
    { value: 'group.update', label: 'Group Update', icon: Users },
  ]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [webhooksRes, logsRes] = await Promise.all([
        api.get('/webhooks'),
        api.get('/webhooks/logs'),
      ])
      const wh = webhooksRes.data
      const lg = logsRes.data
      setWebhooks(Array.isArray(wh) ? wh : Array.isArray(wh?.data) ? wh.data : [])
      setLogs(Array.isArray(lg) ? lg : Array.isArray(lg?.data) ? lg.data : [])
    } catch (error) {
      setWebhooks([])
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const addWebhook = async (e) => {
    e.preventDefault()
    try {
      await api.post('/webhooks', newWebhook)
      toast.success('Webhook added successfully')
      setShowAddForm(false)
      setNewWebhook({ url: '', secret: '', events: ['message.received'] })
      fetchData()
    } catch (error) {
      toast.error('Failed to add webhook')
    }
  }

  const deleteWebhook = async (id) => {
    try {
      await api.delete(`/webhooks/${id}`)
      toast.success('Webhook deleted')
      fetchData()
    } catch (error) {
      toast.error('Failed to delete webhook')
    }
  }

  const toggleEvent = (event) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }))
  }

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-gray-500">Configure webhook endpoints for real-time events</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Add Webhook
        </button>
      </div>

      {/* Add Webhook Form */}
      {showAddForm && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Webhook</h3>
          <form onSubmit={addWebhook} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
              <input
                type="url"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                placeholder="https://your-app.com/webhook"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secret (optional)</label>
              <input
                type="text"
                value={newWebhook.secret}
                onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                placeholder="For webhook signature verification"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {eventOptions.map((event) => (
                  <label
                    key={event.value}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${newWebhook.events.includes(event.value)
                        ? 'border-whatsapp-500 bg-whatsapp-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={newWebhook.events.includes(event.value)}
                      onChange={() => toggleEvent(event.value)}
                      className="w-4 h-4 text-whatsapp-600 rounded border-gray-300"
                    />
                    <event.icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Add Webhook
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Webhooks List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configured Webhooks</h2>
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse p-4 border border-gray-200 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Webhook className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No webhooks configured</p>
            </div>
          ) : (
            webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{webhook.url}</span>
                    {getStatusBadge(webhook.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Events: {webhook.events.join(', ')}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Last triggered: {webhook.lastTriggered ? new Date(webhook.lastTriggered).toLocaleString() : 'Never'}
                  </div>
                </div>
                <button
                  onClick={() => deleteWebhook(webhook.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Logs */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Delivery Logs</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No logs yet
                  </td>
                </tr>
              ) : (
                logs.slice(0, 10).map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{log.event}</td>
                    <td className="px-4 py-3">
                      {log.success ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                          <XCircle className="w-4 h-4" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{log.statusCode || '-'}</td>
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

export default Webhooks
