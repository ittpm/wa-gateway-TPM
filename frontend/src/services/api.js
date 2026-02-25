import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Set token from localStorage on init
const token = localStorage.getItem('token')
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Always get fresh token from localStorage
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login (tapi jangan redirect kalau sudah di login)
      const isLoginPage = window.location.pathname === '/login'
      if (!isLoginPage) {
        localStorage.removeItem('token')
        delete api.defaults.headers.common['Authorization']
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// WebSocket connection for real-time updates
export const createWebSocketConnection = (path) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}${path}`
  return new WebSocket(wsUrl)
}

// Queue API
api.getQueueStats = () => api.get('/queue/stats');
api.pauseQueue = () => api.post('/queue/pause');
api.resumeQueue = () => api.post('/queue/resume');
api.retryQueue = () => api.post('/queue/retry');
api.clearQueue = (status) => api.delete(`/queue?status=${status}`);

// History API
api.getMessages = (params) => api.get('/messages', { params });
api.getSessions = () => api.get('/sessions');

// Webhooks API
api.getWebhooks = () => api.get('/webhooks');

export default api
