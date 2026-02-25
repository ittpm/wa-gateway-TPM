import { useState, useEffect } from 'react'
import { Search, Users, Smartphone, MessageSquare } from 'lucide-react'
import { Card } from '../components/ui/card'
import { api } from '../services/api'
import toast from 'react-hot-toast'

function Groups() {
    const [sessions, setSessions] = useState([])
    const [selectedSession, setSelectedSession] = useState('')
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchSessions()
    }, [])

    useEffect(() => {
        if (selectedSession) {
            fetchGroups(selectedSession)
        } else {
            setGroups([])
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

    const fetchGroups = async (sessionId) => {
        setLoading(true)
        try {
            const res = await api.get(`/sessions/${sessionId}/groups`)
            setGroups(res.data)
        } catch (err) {
            console.error('Failed to fetch groups', err)
            toast.error('Failed to load groups')
        } finally {
            setLoading(false)
        }
    }

    const filteredGroups = groups.filter(g =>
        g.name?.toLowerCase().includes(search.toLowerCase()) ||
        g.jid.includes(search)
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
                    <p className="text-gray-500">View and manage your WhatsApp groups</p>
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

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search groups..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-field pl-9"
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-semibold">{filteredGroups.length}</span> Groups found
                </div>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="p-6 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </Card>
                    ))
                ) : filteredGroups.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No groups found for this session.</p>
                    </div>
                ) : (
                    filteredGroups.map((group) => (
                        <Card key={group.id} className="p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-whatsapp-100 flex items-center justify-center text-whatsapp-600">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 line-clamp-1" title={group.name}>
                                            {group.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 font-mono" title={group.jid}>
                                            {group.jid.slice(0, 15)}...
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    <span>{group.participantCount || '?'} members</span>
                                </div>
                                <button
                                    className="text-whatsapp-600 hover:text-whatsapp-700 font-medium text-xs flex items-center gap-1"
                                    onClick={() => {
                                        // Navigate to send message with this group selected
                                        window.location.href = `/send?to=${group.jid}&type=group`
                                    }}
                                >
                                    <MessageSquare className="w-3 h-3" />
                                    Send Message
                                </button>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}

export default Groups
