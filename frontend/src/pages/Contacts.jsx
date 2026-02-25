import { useState, useEffect } from 'react'
import { Search, RefreshCw, Smartphone, User, Users } from 'lucide-react'
import { Card } from '../components/ui/card'
import { api } from '../services/api'
import toast from 'react-hot-toast'

function Contacts() {
    const [sessions, setSessions] = useState([])
    const [selectedSession, setSelectedSession] = useState('')
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [search, setSearch] = useState('')
    const [stats, setStats] = useState({ total: 0, groups: 0, users: 0 })

    useEffect(() => {
        fetchSessions()
    }, [])

    useEffect(() => {
        if (selectedSession) {
            fetchContacts(selectedSession)
        } else {
            setContacts([])
            setStats({ total: 0, groups: 0, users: 0 })
        }
    }, [selectedSession])

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions')
            const connected = res.data.filter(s => s.status === 'connected')
            setSessions(connected)
            if (connected.length > 0) {
                setSelectedSession(connected[0].id)
            }
        } catch (err) {
            console.error('Failed to fetch sessions', err)
        }
    }

    const fetchContacts = async (sessionId) => {
        setLoading(true)
        try {
            const res = await api.get(`/sessions/${sessionId}/contacts`)
            setContacts(res.data.contacts)

            // Calculate stats
            const total = res.data.total
            const groups = res.data.contacts.filter(c => c.isGroup).length
            setStats({
                total,
                groups,
                users: total - groups
            })
        } catch (err) {
            console.error('Failed to fetch contacts', err)
            toast.error('Failed to load contacts')
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        if (!selectedSession) return

        setSyncing(true)
        try {
            await api.post(`/sessions/${selectedSession}/contacts/sync`)
            toast.success('Sync started! This may take a few minutes.')
            // Refresh after a short delay to show immediate progress if any
            setTimeout(() => fetchContacts(selectedSession), 2000)
        } catch (err) {
            toast.error('Failed to start sync')
        } finally {
            setSyncing(false)
        }
    }

    const filteredContacts = contacts.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
                    <p className="text-gray-500">Manage and sync your WhatsApp contacts</p>
                </div>

                {/* Session Selector */}
                <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-gray-500" />
                    <select
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                        className="input-field py-1 px-3 text-sm min-w-[200px]"
                    >
                        <option value="">Select Session...</option>
                        {sessions.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Total Contacts</p>
                        <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg text-green-600">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Personal</p>
                        <p className="text-2xl font-bold">{stats.users}</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Groups</p>
                        <p className="text-2xl font-bold">{stats.groups}</p>
                    </div>
                </Card>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-field pl-9"
                    />
                </div>
                <button
                    onClick={handleSync}
                    disabled={!selectedSession || syncing}
                    className="btn-secondary flex items-center gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Context'}
                </button>
            </div>

            {/* Contacts List */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number/JID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        Loading contacts...
                                    </td>
                                </tr>
                            ) : filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        No contacts found. Try syncing!
                                    </td>
                                </tr>
                            ) : (
                                filteredContacts.slice(0, 100).map((contact) => (
                                    <tr key={contact.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold mr-3">
                                                    {contact.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {contact.name || 'Unknown'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {contact.phone}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${contact.isGroup
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : 'bg-green-100 text-green-800'
                                                }`}>
                                                {contact.isGroup ? 'Group' : 'User'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(contact.updatedAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {filteredContacts.length > 100 && (
                        <div className="px-6 py-3 bg-gray-50 text-center text-sm text-gray-500 border-t">
                            Showing first 100 of {filteredContacts.length} contacts
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}

export default Contacts
