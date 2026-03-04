import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import SendMessage from './pages/SendMessage'
import Queue from './pages/Queue'
import ScheduledMessages from './pages/ScheduledMessages'
import Webhooks from './pages/Webhooks'
import AntiBlock from './pages/AntiBlock'
import Settings from './pages/Settings'
import Docs from './pages/Docs'
import DocsUmum from './pages/DocsUmum'
import DocsAdvanced from './pages/DocsAdvanced'
import AutoReply from './pages/AutoReply'
import Contacts from './pages/Contacts'
import Groups from './pages/Groups'
import Templates from './pages/Templates'
import History from './pages/History'
import Login from './pages/Login'
import { api } from './services/api'
import { getCurrentUser } from './utils/auth'

// Protected Route wrapper - cek apakah user sudah login
function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setIsAuthenticated(false); return }
      try {
        await api.get('/auth/me')
        setIsAuthenticated(true)
      } catch {
        localStorage.removeItem('token')
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-whatsapp-600"></div>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

// Superadmin-only Route wrapper - fetch role dari API agar akurat meski auth via cookie
function SuperadminRoute({ children }) {
  const [allowed, setAllowed] = useState(null)

  useEffect(() => {
    const checkRole = async () => {
      try {
        const response = await api.get('/auth/me')
        setAllowed(response.data?.user?.role === 'superadmin')
      } catch {
        setAllowed(false)
      }
    }
    checkRole()
  }, [])

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-whatsapp-600"></div>
      </div>
    )
  }
  if (!allowed) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
      <Route path="/send" element={<ProtectedRoute><SendMessage /></ProtectedRoute>} />
      <Route path="/queue" element={<ProtectedRoute><Queue /></ProtectedRoute>} />
      <Route path="/scheduled" element={<ProtectedRoute><ScheduledMessages /></ProtectedRoute>} />
      <Route path="/autoreply" element={<ProtectedRoute><AutoReply /></ProtectedRoute>} />
      <Route path="/webhooks" element={<ProtectedRoute><Webhooks /></ProtectedRoute>} />
      <Route path="/antiblock" element={<ProtectedRoute><AntiBlock /></ProtectedRoute>} />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SuperadminRoute>
              <Settings />
            </SuperadminRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/docs" element={<ProtectedRoute><DocsUmum /></ProtectedRoute>} />
      <Route path="/docs/umum" element={<ProtectedRoute><DocsUmum /></ProtectedRoute>} />
      <Route path="/docs/advanced" element={<ProtectedRoute><DocsAdvanced /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
