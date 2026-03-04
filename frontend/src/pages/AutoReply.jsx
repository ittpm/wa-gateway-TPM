import { useState, useEffect } from 'react'
import { Plus, Bot, Save, Trash2, Edit2, Shield, Settings2, Smartphone, AlertCircle, ToggleLeft, ToggleRight, Sparkles, X, ListOrdered } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export default function AutoReply() {
    const [sessions, setSessions] = useState([])
    const [selectedSessionId, setSelectedSessionId] = useState('')
    
    // Global Settings State
    const [settings, setSettings] = useState({
        autoReplyEnabled: false,
        autoRejectUnknown: false,
        unknownContactMessage: '',
        replyCooldown: 5
    })
    const [savingSettings, setSavingSettings] = useState(false)

    // Rules State
    const [rules, setRules] = useState([])
    const [loadingRules, setLoadingRules] = useState(false)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingRule, setEditingRule] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        triggerType: 'contains',
        triggerValue: '',
        replyMessage: '',
        useAI: false,
        aiPrompt: '',
        isActive: true
    })
    const [savingRule, setSavingRule] = useState(false)

    // Initial Load (Sessions)
    useEffect(() => {
        fetchSessions()
    }, [])

    // Load settings and rules when session changes
    useEffect(() => {
        if (selectedSessionId) {
            fetchSettings(selectedSessionId)
            fetchRules(selectedSessionId)
        } else {
            setRules([])
            setSettings({
                autoReplyEnabled: false,
                autoRejectUnknown: false,
                unknownContactMessage: '',
                replyCooldown: 5
            })
        }
    }, [selectedSessionId])

    const fetchSessions = async () => {
        try {
            const { data } = await api.get('/sessions')
            setSessions(data)
            if (data.length > 0) {
                setSelectedSessionId(data[0].id)
            }
        } catch (error) {
            toast.error('Gagal mengambil daftar session')
        }
    }

    const fetchSettings = async (sessionId) => {
        try {
            const { data } = await api.get(`/autoreply/settings/${sessionId}`)
            setSettings({
                autoReplyEnabled: data.autoReplyEnabled ?? false,
                autoRejectUnknown: data.autoRejectUnknown ?? false,
                unknownContactMessage: data.unknownContactMessage || '',
                replyCooldown: data.replyCooldown ?? 5
            })
        } catch (error) {
            toast.error('Gagal mengambil pengaturan Auto-Reply')
        }
    }

    const fetchRules = async (sessionId) => {
        setLoadingRules(true)
        try {
            const { data } = await api.get(`/autoreply/rules?sessionId=${sessionId}`)
            setRules(data)
        } catch (error) {
            toast.error('Gagal mengambil aturan (rules)')
        } finally {
            setLoadingRules(false)
        }
    }

    const handleSaveSettings = async (e) => {
        e.preventDefault()
        if (!selectedSessionId) return toast.error('Pilih session terlebih dahulu')
        
        setSavingSettings(true)
        try {
            await api.post('/autoreply/settings', {
                sessionId: selectedSessionId,
                ...settings
            })
            toast.success('Pengaturan berhasil disimpan')
        } catch (error) {
            toast.error(error.response?.data?.error || 'Gagal menyimpan pengaturan')
        } finally {
            setSavingSettings(false)
        }
    }

    const handleOpenModal = (rule = null) => {
        if (rule) {
            setEditingRule(rule)
            setFormData({
                name: rule.name,
                triggerType: rule.triggerType,
                triggerValue: rule.triggerValue,
                replyMessage: rule.replyMessage || '',
                useAI: rule.useAI === 1,
                aiPrompt: rule.aiPrompt || '',
                isActive: rule.isActive === 1
            })
        } else {
            setEditingRule(null)
            setFormData({
                name: '',
                triggerType: 'contains',
                triggerValue: '',
                replyMessage: '',
                useAI: false,
                aiPrompt: '',
                isActive: true
            })
        }
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setEditingRule(null)
    }

    const handleSaveRule = async (e) => {
        e.preventDefault()
        if (!selectedSessionId) return toast.error('Pilih session terlebih dahulu')
        
        setSavingRule(true)
        try {
            const payload = { ...formData, sessionId: selectedSessionId }
            
            if (editingRule) {
                await api.put(`/autoreply/rules/${editingRule.id}`, payload)
                toast.success('Aturan berhasil diupdate')
            } else {
                await api.post('/autoreply/rules', payload)
                toast.success('Aturan berhasil ditambahkan')
            }
            
            handleCloseModal()
            fetchRules(selectedSessionId)
        } catch (error) {
            toast.error(error.response?.data?.error || 'Gagal menyimpan aturan')
        } finally {
            setSavingRule(false)
        }
    }

    const handleDeleteRule = async (id) => {
        if (!window.confirm('Hapus aturan ini?')) return
        try {
            await api.delete(`/autoreply/rules/${id}`)
            toast.success('Aturan dihapus')
            fetchRules(selectedSessionId)
        } catch (error) {
            toast.error('Gagal menghapus aturan')
        }
    }

    const toggleRuleStatus = async (rule) => {
        try {
            await api.put(`/autoreply/rules/${rule.id}`, { ...rule, isActive: rule.isActive ? 0 : 1 })
            fetchRules(selectedSessionId)
        } catch (error) {
            toast.error('Gagal mengubah status aturan')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Bot className="w-6 h-6 text-whatsapp-600" />
                        Auto-Reply & AI Bot
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Balas pesan pelanggan otomatis menggunakan kata kunci maupun kecerdasan buatan (AI).
                    </p>
                </div>

                {/* Session Selector */}
                <div className="w-full sm:w-64">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pilih Session</label>
                    <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            value={selectedSessionId}
                            onChange={(e) => setSelectedSessionId(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-whatsapp-500 focus:border-transparent outline-none appearance-none"
                            disabled={sessions.length === 0}
                        >
                            {sessions.length === 0 && <option value="">Tidak ada session aktif</option>}
                            {sessions.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.phone || 'Standby'})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {sessions.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-amber-800">Tidak ada WhatsApp Session</h3>
                        <p className="text-sm text-amber-600 mt-1">Anda harus mendaftarkan dan menghubungkan minimal satu nomor WhatsApp di menu Sessions untuk menggunakan fitur ini.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* GLOBAL SETTINGS CARD */}
                <div className="lg:col-span-1 border border-gray-200 bg-white rounded-xl overflow-hidden shadow-sm h-fit">
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-gray-500" />
                        <h3 className="font-semibold text-gray-900">Pengaturan Global</h3>
                    </div>
                    <form onSubmit={handleSaveSettings} className="p-5 space-y-5">
                        
                        {/* Auto Reply Enable */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">Aktifkan Auto-Reply</h4>
                                <p className="text-xs text-gray-500">Nyalakan fitur mesin pembalas</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSettings({ ...settings, autoReplyEnabled: !settings.autoReplyEnabled })}
                                className={`\${settings.autoReplyEnabled ? 'text-whatsapp-500' : 'text-gray-300'} transition-colors`}
                                disabled={!selectedSessionId}
                            >
                                {settings.autoReplyEnabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                            </button>
                        </div>

                        {/* Cooldown */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Jeda Waktu (Detik)</label>
                            <input
                                type="number"
                                min="0"
                                value={settings.replyCooldown}
                                onChange={e => setSettings({ ...settings, replyCooldown: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-whatsapp-500 outline-none text-sm"
                                disabled={!selectedSessionId}
                                placeholder="Contoh: 5"
                            />
                            <p className="text-xs text-gray-500 mt-1">Jeda bot membalas pesan dari orang yang sama agar tidak spam.</p>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Auto Reject Unknown */}
                        <div className="flex items-start justify-between">
                            <div className="pr-4">
                                <h4 className="text-sm font-semibold text-gray-900">Fallback/Tolak Nomor Asing</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Otomatis balas pesan dari nomor yang belum tersimpan di kontak Anda.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSettings({ ...settings, autoRejectUnknown: !settings.autoRejectUnknown })}
                                className={`\${settings.autoRejectUnknown ? 'text-red-500' : 'text-gray-300'} transition-colors`}
                                disabled={!selectedSessionId}
                            >
                                {settings.autoRejectUnknown ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                            </button>
                        </div>

                        {settings.autoRejectUnknown && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pesan Balasan Nomor Asing</label>
                                <textarea
                                    value={settings.unknownContactMessage}
                                    onChange={e => setSettings({ ...settings, unknownContactMessage: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-whatsapp-500 outline-none text-sm h-20 resize-none"
                                    placeholder="Maaf, kami hanya melayani nomor yang sudah terdaftar..."
                                    required={settings.autoRejectUnknown}
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={savingSettings || !selectedSessionId}
                            className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                            {savingSettings ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            Simpan Pengaturan
                        </button>
                    </form>
                </div>

                {/* RULES LIST */}
                <div className="lg:col-span-2 border border-gray-200 bg-white rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <ListOrdered className="w-5 h-5 text-gray-500" />
                            <h3 className="font-semibold text-gray-900">Daftar Keyword & Aturan (Rules)</h3>
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            disabled={!selectedSessionId}
                            className="flex items-center gap-2 px-3 py-1.5 bg-whatsapp-600 text-white text-sm font-medium rounded-lg hover:bg-whatsapp-700 disabled:opacity-50 transition-colors w-full sm:w-auto justify-center"
                        >
                            <Plus className="w-4 h-4" />
                            Tambah Aturan
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-5 py-3 rounded-tl-xl truncate">Nama & Keyword</th>
                                    <th className="px-5 py-3 hidden sm:table-cell">Respons</th>
                                    <th className="px-5 py-3 w-10 text-center">Status</th>
                                    <th className="px-5 py-3 w-20 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loadingRules ? (
                                    <tr><td colSpan="4" className="text-center py-8 text-gray-500">Memuat...</td></tr>
                                ) : rules.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-12 px-4">
                                            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500 font-medium">Belum ada aturan Auto-Reply</p>
                                            <p className="text-xs text-gray-400 mt-1">Tambahkan keyword baru untuk memulai.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    rules.map((rule) => (
                                        <tr key={rule.id} className="hover:bg-gray-50 group">
                                            <td className="px-5 py-3">
                                                <div className="font-medium text-gray-900">{rule.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        {rule.triggerType}
                                                    </span>
                                                    <code className="text-xs text-whatsapp-700 bg-whatsapp-50 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                                                        {rule.triggerValue}
                                                    </code>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 hidden sm:table-cell">
                                                {rule.useAI === 1 ? (
                                                    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                        <span className="text-xs font-semibold">AI Assistant</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-600 line-clamp-2 max-w-xs">{rule.replyMessage}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <button onClick={() => toggleRuleStatus(rule)} className={`\${rule.isActive ? 'text-green-500' : 'text-gray-300'}`}>
                                                    {rule.isActive ? <ToggleRight className="w-8 h-8 mx-auto" /> : <ToggleLeft className="w-8 h-8 mx-auto" />}
                                                </button>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleOpenModal(rule)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg" title="Hapus">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* RULE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-900">{editingRule ? 'Edit Aturan' : 'Tambah Aturan Baru'}</h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveRule} className="p-6 overflow-y-auto space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Aturan</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-whatsapp-500 outline-none text-sm"
                                    placeholder="Contoh: Balasan Info Harga"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Trigger</label>
                                    <select
                                        value={formData.triggerType}
                                        onChange={e => setFormData({ ...formData, triggerType: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-whatsapp-500 outline-none text-sm bg-white"
                                    >
                                        <option value="exact">Sama Persis (Exact)</option>
                                        <option value="contains">Mengandung Kata (Contains)</option>
                                        <option value="startsWith">Berawalan Kata (Starts With)</option>
                                        <option value="regex">Pola RegEx</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kata Kunci (Value)</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.triggerValue}
                                        onChange={e => setFormData({ ...formData, triggerValue: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-whatsapp-500 outline-none text-sm"
                                        placeholder="Contoh: harga"
                                    />
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-blue-500" />
                                            Gunakan AI Assistant (Kimi)
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Berikan instruksi (prompt) dan biarkan AI menjawab secara dinamis.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, useAI: !formData.useAI, replyMessage: '', aiPrompt: '' })}
                                        className={`\${formData.useAI ? 'text-blue-500' : 'text-gray-300'} transition-colors`}
                                    >
                                        {formData.useAI ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                                    </button>
                                </div>

                                {formData.useAI ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Instruksi AI (System Prompt)</label>
                                        <textarea
                                            required={formData.useAI}
                                            value={formData.aiPrompt}
                                            onChange={e => setFormData({ ...formData, aiPrompt: e.target.value })}
                                            className="w-full px-3 py-2 border border-blue-200 bg-blue-50/30 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm h-32 resize-none"
                                            placeholder="Anda adalah asisten penjualan yang ramah. Daftar harga: Paket A Rp 50.000, Paket B Rp 100.000. Jawab pertanyaan pelanggan dengan singkat dan sopan."
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pesan Balasan Statis</label>
                                        <textarea
                                            required={!formData.useAI}
                                            value={formData.replyMessage}
                                            onChange={e => setFormData({ ...formData, replyMessage: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-whatsapp-500 outline-none text-sm h-32 resize-none"
                                            placeholder="Terima kasih, berikut adalah daftar harga kami..."
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="rounded border-gray-300 text-whatsapp-600 focus:ring-whatsapp-500"
                                />
                                <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer">Aturan ini langsung aktif setelah disimpan</label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingRule}
                                    className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-whatsapp-600 text-white rounded-lg font-medium text-sm hover:bg-whatsapp-700 disabled:opacity-50 transition-colors"
                                >
                                    {savingRule ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                    Simpan Aturan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
