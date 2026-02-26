import { TrendingUp } from 'lucide-react'

function StatsCard({ title, value, total, icon: Icon, color, trend, subtitle, loading }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    whatsapp: 'bg-whatsapp-100 text-whatsapp-600',
    red: 'bg-red-100 text-red-600',
  }

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-10 w-10 bg-gray-200 rounded-lg mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className="flex items-center text-sm font-medium text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-gray-900">
          {(value ?? 0).toLocaleString()}
          {total !== undefined && (
            <span className="text-sm font-normal text-gray-500 ml-1">
              / {total}
            </span>
          )}
        </h3>
        <p className="text-sm text-gray-500 mt-1">{title}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

export default StatsCard
