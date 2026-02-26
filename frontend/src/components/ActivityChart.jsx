import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { api } from '../services/api'

function ActivityChart() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivityData()
  }, [])

  const fetchActivityData = async () => {
    try {
      const response = await api.get('/stats/activity')
      const rawData = response.data
      const activityList = Array.isArray(rawData) ? rawData :
        Array.isArray(rawData?.data) ? rawData.data : null
      if (activityList) {
        setData(activityList)
      } else {
        throw new Error('Invalid data format')
      }
    } catch (error) {
      // Generate mock data if API fails or returns unexpected format
      const mockData = Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        sent: 0,
        delivered: 0,
        failed: 0,
      }))
      setData(mockData)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card h-96 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Message Activity (24h)</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-whatsapp-500"></span>
            Sent
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            Delivered
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            Failed
          </span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="sent"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="delivered"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="failed"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ActivityChart
