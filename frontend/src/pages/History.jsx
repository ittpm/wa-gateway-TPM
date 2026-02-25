import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function History() {
    const [messages, setMessages] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        sessionId: '',
        status: '',
        search: ''
    });
    const [sessions, setSessions] = useState([]);

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        fetchMessages();
    }, [filters, pagination.page]);

    const fetchSessions = async () => {
        try {
            const response = await api.getSessions();
            setSessions(response.data);
        } catch (error) {
            console.error('Failed to fetch sessions', error);
        }
    };

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const response = await api.getMessages({
                page: pagination.page,
                limit: pagination.limit,
                ...filters
            });
            setMessages(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to fetch messages', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
        setPagination({ ...pagination, page: 1 }); // Reset to first page
    };

    const statusColors = {
        pending: 'bg-gray-100 text-gray-800',
        processing: 'bg-blue-100 text-blue-800',
        sent: 'bg-indigo-100 text-indigo-800',
        delivered: 'bg-yellow-100 text-yellow-800',
        read: 'bg-green-100 text-green-800',
        failed: 'bg-red-100 text-red-800',
        queued: 'bg-purple-100 text-purple-800'
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Riwayat Pesan</h1>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap gap-4">
                <select
                    name="sessionId"
                    value={filters.sessionId}
                    onChange={handleFilterChange}
                    className="border rounded px-3 py-2 text-sm"
                >
                    <option value="">Semua Sesi</option>
                    {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                    ))}
                </select>

                <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="border rounded px-3 py-2 text-sm"
                >
                    <option value="">Semua Status</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="read">Read</option>
                    <option value="failed">Failed</option>
                </select>

                <input
                    type="text"
                    name="search"
                    placeholder="Cari pesan atau nomor..."
                    value={filters.search}
                    onChange={handleFilterChange}
                    className="border rounded px-3 py-2 text-sm flex-grow"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sesi</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tujuan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pesan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center">Memuat...</td>
                            </tr>
                        ) : messages.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center">Tidak ada data</td>
                            </tr>
                        ) : (
                            messages.map((msg) => (
                                <tr key={msg.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(msg.createdAt).toLocaleString()}
                                        {msg.scheduledAt && <div className="text-xs text-blue-500">Jadwal: {new Date(msg.scheduledAt).toLocaleString()}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sessions.find(s => s.id === msg.sessionId)?.name || msg.sessionId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{msg.to}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{msg.content}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[msg.status] || 'bg-gray-100'}`}>
                                            {msg.status}
                                        </span>
                                        {msg.status === 'failed' && <div className="text-xs text-red-500 mt-1">{msg.error}</div>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex justify-between items-center">
                <button
                    onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border rounded disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages} (Total {pagination.total})
                </span>
                <button
                    onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-4 py-2 border rounded disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
