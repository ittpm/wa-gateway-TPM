import React, { useState, useEffect } from 'react';
import { Trash2, XCircle, Image as ImageIcon, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

// Konversi path lokal server (/opt/.../uploads/file.jpg) ke URL HTTP (/uploads/file.jpg)
// yang bisa diakses browser melalui backend endpoint /uploads
function getMediaUrl(mediaUrl) {
    if (!mediaUrl) return null;
    // Sudah berupa URL http/https atau data URI → langsung pakai
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://') || mediaUrl.startsWith('data:')) {
        return mediaUrl;
    }
    // Path lokal: ambil bagian setelah '/uploads/'
    const uploadsIndex = mediaUrl.indexOf('/uploads/');
    if (uploadsIndex !== -1) {
        const relativePath = mediaUrl.substring(uploadsIndex); // → /uploads/...
        return relativePath; // Nginx/backend akan serve ini
    }
    // Fallback: coba gunakan apa adanya
    return mediaUrl;
}

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
    const [selectedMessage, setSelectedMessage] = useState(null); // Modal state

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

    const clearQueue = async (status) => {
        try {
            await api.clearQueue(status);
            toast.success(`Berhasil menghapus riwayat pesan: ${status === 'all' ? 'Semua' : status}`);
            fetchMessages(); // Refresh list after clear
        } catch (error) {
            toast.error('Gagal menghapus riwayat');
        }
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Riwayat Pesan</h1>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            if (window.confirm('Yakin ingin menghapus semua riwayat pesan (termasuk yang berhasil dan gagal)?')) {
                                clearQueue('all');
                            }
                        }}
                        className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md flex items-center gap-2 font-medium transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Hapus Semua Riwayat
                    </button>
                    <button
                        onClick={() => {
                            if (window.confirm('Yakin ingin menghapus semua riwayat pesan yang gagal?')) {
                                clearQueue('failed');
                            }
                        }}
                        className="text-sm bg-gray-100 border border-gray-300 hover:bg-red-50 hover:text-red-600 text-gray-700 px-3 py-2 rounded-md flex items-center gap-2 font-medium transition-colors"
                    >
                        <XCircle className="w-4 h-4" />
                        Hapus yang Gagal
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap gap-4">
                <select
                    name="sessionId"
                    value={filters.sessionId}
                    onChange={handleFilterChange}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
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
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">Semua Status</option>
                    <option value="pending">Pending</option>
                    <option value="queued">Queued</option>
                    <option value="processing">Processing</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="read">Read</option>
                    <option value="failed">Failed</option>
                </select>

                <input
                    type="text"
                    name="search"
                    placeholder="Cari isi pesan atau nomor..."
                    value={filters.search}
                    onChange={handleFilterChange}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-grow focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">Waktu</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Sesi</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Tujuan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Pesan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                    Memuat...
                                </td>
                            </tr>
                        ) : messages.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                    Tidak ada data pesan
                                </td>
                            </tr>
                        ) : (
                            messages.map((msg) => (
                                <tr 
                                    key={msg.id} 
                                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                                    onClick={() => setSelectedMessage(msg)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(msg.createdAt).toLocaleString()}
                                        {msg.scheduledAt && <div className="text-xs text-blue-500 mt-1">Jadwal: {new Date(msg.scheduledAt).toLocaleString()}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{sessions.find(s => s.id === msg.sessionId)?.name || msg.sessionId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{msg.to}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            {msg.mediaUrl && <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                                            {msg.fileName && !msg.mediaUrl && <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                                            <span className="truncate max-w-[200px] lg:max-w-xs inline-block">
                                                {msg.content || (msg.mediaUrl ? '[Media Lampiran]' : '[File]')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[msg.status] || 'bg-gray-100'}`}>
                                            {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
                                        </span>
                                        {msg.status === 'failed' && <div className="text-xs text-red-500 mt-1 truncate max-w-[100px]" title={msg.error}>{msg.error}</div>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex justify-between items-center bg-white p-4 rounded-lg shadow">
                <button
                    onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 text-sm font-medium"
                >
                    Sebelumnya
                </button>
                <span className="text-sm text-gray-600">
                    Halaman {pagination.page} dari {pagination.totalPages || 1} (Total {pagination.total})
                </span>
                <button
                    onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages || pagination.totalPages === 0}
                    className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 text-sm font-medium"
                >
                    Selanjutnya
                </button>
            </div>

            {/* Message Detail Modal */}
            {selectedMessage && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedMessage(null); }}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col transform transition-all">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-lg font-bold text-gray-800">Detail Pesan</h2>
                            <button onClick={() => setSelectedMessage(null)} className="text-gray-400 hover:text-gray-600 bg-gray-200/50 hover:bg-gray-200 rounded-full p-1 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tujuan</p>
                                    <p className="font-medium text-gray-900">{selectedMessage.to}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[selectedMessage.status] || 'bg-gray-100'}`}>
                                        {selectedMessage.status.toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Waktu Dibuat</p>
                                    <p className="text-sm text-gray-900">{new Date(selectedMessage.createdAt).toLocaleString()}</p>
                                </div>
                                {selectedMessage.scheduledAt && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Jadwal Kirim</p>
                                        <p className="text-sm text-blue-600 font-medium">{new Date(selectedMessage.scheduledAt).toLocaleString()}</p>
                                    </div>
                                )}
                            </div>

                            {selectedMessage.error && (
                                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                                    <p className="text-sm font-bold text-red-800 mb-1">Pesan Gagal Terkirim:</p>
                                    <p className="text-sm text-red-600 break-words">{selectedMessage.error}</p>
                                </div>
                            )}

                            <div className="mb-6">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Isi Pesan:</p>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-800 whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-64 overflow-y-auto">
                                    {selectedMessage.content || <span className="text-gray-400 italic">Tidak ada teks/hanya media</span>}
                                </div>
                            </div>

                            {/* Media Attachment View */}
                            {selectedMessage.mediaUrl && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lampiran Media:</p>
                                    {(() => {
                                        const httpUrl = getMediaUrl(selectedMessage.mediaUrl);
                                        const isImage = selectedMessage.type === 'image' ||
                                            selectedMessage.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ||
                                            selectedMessage.mediaUrl.startsWith('data:image');
                                        return isImage ? (
                                            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex justify-center p-2">
                                                <img src={httpUrl} alt="Media lampiran" className="max-w-full h-auto max-h-80 object-contain rounded" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                                <div className="bg-white p-2 rounded-full shadow-sm">
                                                    <FileText className="w-6 h-6 text-blue-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-blue-900 text-sm">Dokumen / Media Lainnya</p>
                                                    <a href={httpUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 mt-1">
                                                        Lihat / Unduh File
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                            <button onClick={() => setSelectedMessage(null)} className="px-5 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm focus:ring-4 focus:ring-gray-200">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}