import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    BookOpen, Code, Shield, Smartphone, Webhook, Send,
    ListOrdered, BarChart3, CheckCircle, Terminal, FileJson,
    AlertCircle, Lightbulb, ChevronRight, Copy, Check,
    FileText, Users, Bot, Calendar, ArrowLeft, BookMarked, Zap
} from 'lucide-react'

function CodeBlock({ code }) {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <div className="relative group">
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={copy} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    )
}

function Section({ id, title, icon: Icon, children }) {
    return (
        <section id={id} className="mb-10 scroll-mt-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-gray-100">
                {Icon && <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-700" />
                </div>}
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            </div>
            {children}
        </section>
    )
}

function Endpoint({ method, path, description, params, response, note }) {
    const colors = {
        GET: 'bg-green-100 text-green-700 border-green-200',
        POST: 'bg-blue-100 text-blue-700 border-blue-200',
        PUT: 'bg-amber-100 text-amber-700 border-amber-200',
        DELETE: 'bg-red-100 text-red-700 border-red-200',
        PATCH: 'bg-purple-100 text-purple-700 border-purple-200',
    }
    return (
        <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-white hover:shadow-md transition-shadow">
            <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[method] || 'bg-gray-100 text-gray-700'}`}>
                    {method}
                </span>
                <code className="text-gray-800 font-mono text-sm bg-gray-50 px-2 py-0.5 rounded">{path}</code>
            </div>
            <p className="text-gray-600 text-sm mb-3">{description}</p>
            {note && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">⚠️ {note}</p>}
            {params && (
                <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Request Body:</p>
                    <CodeBlock code={params} />
                </div>
            )}
            {response && (
                <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Response:</p>
                    <CodeBlock code={response} />
                </div>
            )}
        </div>
    )
}

function DocsAdvanced() {
    const navigate = useNavigate()

    const sections = [
        { id: 'auth', label: 'Autentikasi', icon: Shield },
        { id: 'sessions', label: 'Sessions', icon: Smartphone },
        { id: 'messages', label: 'Messages', icon: Send },
        { id: 'media-upload', label: 'Media Upload', icon: FileText },
        { id: 'scheduled', label: 'Scheduled', icon: Calendar },
        { id: 'queue', label: 'Queue', icon: ListOrdered },
        { id: 'webhooks', label: 'Webhooks', icon: Webhook },
        { id: 'contacts', label: 'Contacts', icon: Users },
        { id: 'templates', label: 'Templates', icon: FileText },
        { id: 'autoreply', label: 'Auto-Reply', icon: Bot },
        { id: 'antiblock', label: 'Anti-Block', icon: Shield },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'pool', label: 'Session Pool', icon: Zap },
        { id: 'examples', label: 'Contoh Kode', icon: Terminal },
        { id: 'errors', label: 'Error Codes', icon: AlertCircle },
        { id: 'tips', label: 'Tips & Best Practices', icon: Lightbulb },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BookMarked className="w-6 h-6 text-gray-700" />
                        Dokumentasi API — Advanced
                    </h1>
                    <p className="text-gray-500 mt-1">Referensi lengkap seluruh endpoint WA Gateway API v1.0.0</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/docs/umum')}
                        className="flex items-center gap-2 px-4 py-2 bg-whatsapp-600 text-white text-sm font-medium rounded-lg hover:bg-whatsapp-700 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Kembali ke Umum
                    </button>
                </div>
            </div>

            {/* Base URL */}
            <div className="bg-gray-900 rounded-xl p-4 text-white">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Code className="w-3 h-3" /> Base URL</p>
                <code className="text-green-400 font-mono">https://watpm.tpm.co.id/api/v1</code>
                <span className="mx-3 text-gray-600">|</span>
                <code className="text-blue-400 font-mono">X-API-Key: wak_xxx...</code>
            </div>

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="hidden lg:block">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4 max-h-[85vh] overflow-y-auto">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> Daftar Endpoint
                        </p>
                        <nav className="space-y-0.5">
                            {sections.map(s => (
                                <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                                >
                                    <s.icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
                                    {s.label}
                                </a>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-3 space-y-2">

                    {/* Auth */}
                    <Section id="auth" title="🔐 Autentikasi" icon={Shield}>
                        <p className="text-sm text-gray-600 mb-4">
                            Semua endpoint memerlukan autentikasi. Gunakan salah satu metode:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                            {[
                                { label: 'API Key Header', code: 'X-API-Key: wak_xxx', color: 'blue' },
                                { label: 'Bearer JWT', code: 'Authorization: Bearer eyJ...', color: 'purple' },
                                { label: 'HTTP-only Cookie', code: 'Set via login endpoint', color: 'green' },
                            ].map(m => (
                                <div key={m.label} className={`bg-${m.color}-50 border border-${m.color}-200 rounded-xl p-3`}>
                                    <p className={`text-xs font-bold text-${m.color}-700 mb-1`}>{m.label}</p>
                                    <code className={`text-xs text-${m.color}-600 block`}>{m.code}</code>
                                </div>
                            ))}
                        </div>
                        <Endpoint
                            method="POST"
                            path="/auth/login"
                            description="Login dan dapatkan JWT token."
                            params={`{
  "username": "admin",
  "password": "your-password"
}`}
                            response={`{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "uuid", "username": "admin", "role": "superadmin" }
}`}
                        />
                        <Endpoint method="GET" path="/auth/me" description="Ambil info user yang sedang login." response={`{ "user": { "id": "uuid", "username": "admin", "role": "superadmin" } }`} />
                        <Endpoint method="POST" path="/auth/logout" description="Logout dan hapus session cookie." />
                    </Section>

                    {/* Sessions */}
                    <Section id="sessions" title="📱 Sessions" icon={Smartphone}>
                        <p className="text-sm text-gray-600 mb-4">Kelola perangkat WhatsApp yang terhubung.</p>
                        <Endpoint
                            method="GET"
                            path="/sessions"
                            description="Daftar semua session beserta status koneksi dan jumlah kontak."
                            response={`[
  {
    "id": "uuid-session",
    "name": "Akun Bisnis",
    "phone": "6281234567890",
    "status": "connected",
    "token": "wak_xxx",
    "apiKey": "wak_abc_xxx",
    "contactsCount": 350,
    "messageCount": 1500,
    "createdAt": "2024-01-15T08:30:00Z"
  }
]`}
                        />
                        <Endpoint
                            method="POST"
                            path="/sessions"
                            description="Buat session WhatsApp baru."
                            params={`{ "name": "Akun Bisnis 2" }`}
                            response={`{
  "id": "uuid-session",
  "name": "Akun Bisnis 2",
  "status": "connecting",
  "apiKey": "wak_abc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "message": "Session dibuat. QR akan tersedia."
}`}
                        />
                        <Endpoint method="GET" path="/sessions/{id}/qr" description="Ambil QR code (auto-refresh setiap 20 detik)." response={`{
  "qrCode": "data:image/png;base64,...",
  "status": "qr",
  "updatedAt": "2024-01-15T08:30:00Z",
  "hasQR": true
}`} />
                        <Endpoint method="POST" path="/sessions/{id}/reconnect" description="Reconnect session yang terputus." />
                        <Endpoint method="POST" path="/sessions/{id}/logout" description="Logout dari WhatsApp (session tetap ada di sistem)." />
                        <Endpoint method="DELETE" path="/sessions/{id}" description="Hapus session secara permanen." />
                        <Endpoint method="POST" path="/sessions/{id}/refresh" description="Force refresh status session dari WhatsApp server." />
                        <Endpoint method="POST" path="/sessions/{id}/regenerate-key" description="Generate ulang API Key untuk session." response={`{ "apiKey": "wak_abc_newkey...", "message": "API key berhasil di-regenerate" }`} />
                        <Endpoint method="GET" path="/sessions/{id}/contacts" description="Ambil daftar kontak dari session." />
                        <Endpoint method="POST" path="/sessions/{id}/contacts/sync" description="Trigger sync kontak manual (rate-limited: 30 detik antar sync)." />
                        <Endpoint method="GET" path="/sessions/{id}/groups" description="Ambil daftar grup dari session." />
                    </Section>

                    {/* Messages */}
                    <Section id="messages" title="💬 Messages" icon={Send}>
                        <Endpoint
                            method="POST"
                            path="/messages/send"
                            description="Kirim pesan ke satu nomor (text, image, video, document, location, vcard)."
                            params={`{
  "sessionId": "uuid-session",
  "to": "6281234567890",
  "type": "text",           // text | image | video | document | location | vcard
  "message": "Hello!",     // untuk type text
  "mediaUrl": "https://...",  // untuk type image/video/document
  "caption": "Caption...",
  "fileName": "doc.pdf",   // untuk document
  "latitude": -6.2088,     // untuk location
  "longitude": 106.8456,
  "contactName": "John",   // untuk vcard
  "contactPhone": "+6281234567890",
  "useSpintax": false,
  "delay": true,
  "scheduledAt": "2024-12-25T08:00:00+07:00"  // opsional, untuk penjadwalan
}`}
                            response={`{
  "messageId": "uuid-message",
  "status": "queued",
  "message": "Pesan telah ditambahkan ke antrean"
}`}
                        />
                        <Endpoint
                            method="POST"
                            path="/messages/bulk"
                            description="Kirim pesan teks ke banyak penerima sekaligus."
                            params={`{
  "sessionId": "uuid-session",
  "recipients": ["6281234567890", "6289876543210"],
  "message": "Halo {teman|saudara}, ada promo!",
  "useSpintax": true,
  "delay": true
}`}
                            response={`{
  "queued": 2,
  "messageIds": ["uuid-1", "uuid-2"],
  "status": "queued"
}`}
                        />
                        <Endpoint
                            method="POST"
                            path="/messages/send-auto"
                            description="Kirim pesan tanpa menentukan sessionId — sistem pilih session terbaik otomatis (load balancing)."
                            params={`{
  "to": "6281234567890",
  "type": "text",
  "message": "OTP: 123456",
  "delay": false
}`}
                            response={`{
  "messageId": "uuid-msg",
  "sessionId": "uuid-session-terpilih",
  "sessionPhone": "6281234567890",
  "status": "queued"
}`}
                        />
                        <Endpoint
                            method="POST"
                            path="/messages/presence"
                            description="Kirim typing indicator ke kontak."
                            params={`{
  "sessionId": "uuid-session",
  "to": "6281234567890@s.whatsapp.net",
  "type": "composing"   // composing | recording | available | unavailable
}`}
                        />
                        <Endpoint
                            method="POST"
                            path="/messages/send-template"
                            description="Kirim pesan menggunakan template yang sudah tersimpan."
                            params={`{
  "templateId": "uuid-template",
  "to": "6281234567890",
  "sessionId": "uuid-session",
  "variables": {
    "nama": "Budi",
    "total": "150.000"
  }
}`}
                        />
                        <Endpoint
                            method="GET"
                            path="/messages"
                            description="Riwayat pesan dengan filter dan pagination."
                            params={`# Query params:
?sessionId=uuid-session
&status=completed
&search=hello
&page=1
&limit=20`}
                            response={`{
  "data": [ { "id": "...", "to": "...", "status": "completed" } ],
  "pagination": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 }
}`}
                        />
                    </Section>

                    {/* Media Upload */}
                    <Section id="media-upload" title="📎 Media Upload" icon={FileText}>
                        <Endpoint
                            method="POST"
                            path="/messages/send-media"
                            description="Upload dan kirim file langsung (multipart/form-data). Dikirim segera, tanpa penjadwalan."
                            params={`# multipart/form-data fields:
sessionId  = "uuid-session"
to         = "6281234567890"
caption    = "Deskripsi file"
file       = [BINARY: gambar/video/dokumen, max 5MB]`}
                            response={`{
  "messageId": "uuid-msg",
  "status": "queued",
  "fileName": "gambar.jpg",
  "fileType": "image",
  "message": "File uploaded and queued for sending"
}`}
                        />
                        <Endpoint
                            method="POST"
                            path="/messages/upload-scheduled"
                            description="Upload file dan jadwalkan pengiriman. File disimpan di server (./uploads/scheduled/) dan otomatis dihapus setelah 30 hari."
                            params={`# multipart/form-data fields:
sessionId   = "uuid-session"
to          = "6281234567890"
caption     = "Laporan terlampir"
scheduledAt = "2024-12-25T01:00:00.000Z"   ← UTC ISO 8601
file        = [BINARY: gambar/dokumen, max 5MB]`}
                            response={`{
  "messageId": "uuid-msg",
  "status": "scheduled",
  "fileName": "laporan.pdf",
  "fileType": "document",
  "scheduledAt": "2024-12-25T01:00:00.000Z",
  "message": "File disimpan dan akan dikirim pada 25 Des 2024, 08.00"
}`}
                        />
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                            <p className="font-semibold mb-1">📁 Tipe file yang didukung</p>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div><strong>Image:</strong> JPEG, PNG, GIF, WebP</div>
                                <div><strong>Video:</strong> MP4, AVI, MOV</div>
                                <div><strong>Audio:</strong> MP3, OGG, WAV</div>
                                <div><strong>Document:</strong> PDF, Word, Excel, PPT, TXT, ZIP</div>
                            </div>
                            <p className="mt-2">Ukuran maksimal: <strong>5 MB per file</strong></p>
                        </div>
                    </Section>

                    {/* Scheduled */}
                    <Section id="scheduled" title="📅 Scheduled Messages" icon={Calendar}>
                        <Endpoint method="GET" path="/queue" description="Lihat semua pesan (termasuk yang terjadwal). Filter di frontend: status=pending + scheduledAt di masa depan." />
                        <Endpoint method="DELETE" path="/queue/{id}" description="Batalkan pesan terjadwal (hapus dari queue)." />
                        <p className="text-xs text-gray-500 mt-2">
                            Untuk menjadwalkan pesan teks: tambahkan <code>scheduledAt</code> ke <code>POST /messages/send</code>.<br />
                            Untuk menjadwalkan dengan file: gunakan <code>POST /messages/upload-scheduled</code>.
                        </p>
                    </Section>

                    {/* Queue */}
                    <Section id="queue" title="📊 Queue" icon={ListOrdered}>
                        <Endpoint method="GET" path="/queue" description="Lihat pesan pending dan sedang diproses." response={`[
  {
    "id": "uuid-msg",
    "to": "6281234567890",
    "type": "text",
    "content": "Hello",
    "status": "pending",
    "attempts": 0,
    "scheduledAt": null,
    "createdAt": "2024-01-15T08:30:00Z"
  }
]`} />
                        <Endpoint method="GET" path="/queue/stats" description="Statistik antrean." response={`{ "pending": 5, "processing": 1, "completed": 200, "failed": 3 }`} />
                        <Endpoint method="POST" path="/queue/pause" description="Jeda pemrosesan antrean." />
                        <Endpoint method="POST" path="/queue/resume" description="Lanjutkan antrean." />
                        <Endpoint method="POST" path="/queue/retry" description="Ulangi semua pesan yang gagal." />
                        <Endpoint method="DELETE" path="/queue?status=completed" description="Bersihkan antrean berdasarkan status (completed/failed)." />
                        <Endpoint method="DELETE" path="/queue/{id}" description="Hapus satu pesan dari antrean." />
                    </Section>

                    {/* Webhooks */}
                    <Section id="webhooks" title="🔗 Webhooks" icon={Webhook}>
                        <Endpoint method="GET" path="/webhooks" description="Daftar semua webhook." />
                        <Endpoint
                            method="POST"
                            path="/webhooks"
                            description="Tambah webhook baru."
                            params={`{
  "url": "https://your-app.com/webhook",
  "secret": "webhook-secret",
  "events": ["message.received", "message.sent", "message.failed", "session.connected", "session.disconnected"]
}`}
                        />
                        <Endpoint method="PUT" path="/webhooks/{id}" description="Update webhook." params={`{ "url": "https://new-url.com/webhook", "events": ["message.received"] }`} />
                        <Endpoint method="DELETE" path="/webhooks/{id}" description="Hapus webhook." />
                        <Endpoint method="GET" path="/webhooks/logs" description="Log pengiriman webhook (100 log terakhir)." />
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Contoh Payload Webhook</p>
                            <CodeBlock code={`// message.received
{
  "event": "message.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "uuid-session",
  "data": {
    "from": "6281234567890",
    "message": "Halo!",
    "type": "text",
    "timestamp": 1705312200
  }
}

// message.sent / message.failed
{
  "event": "message.sent",
  "data": {
    "messageId": "uuid-msg",
    "waMessageId": "3EB0...",
    "to": "6281234567890",
    "type": "text"
  }
}`} />
                        </div>
                    </Section>

                    {/* Contacts */}
                    <Section id="contacts" title="👥 Contacts" icon={Users}>
                        <Endpoint method="GET" path="/sessions/{id}/contacts" description="Ambil daftar kontak dari session dengan opsional pencarian." params={`# Query: ?search=nama`} />
                        <Endpoint method="POST" path="/sessions/{id}/contacts/sync" description="Trigger sync kontak manual. Rate-limited: 30 detik antar sync." />
                    </Section>

                    {/* Templates */}
                    <Section id="templates" title="📝 Templates" icon={FileText}>
                        <Endpoint method="GET" path="/templates" description="Daftar semua template pesan." />
                        <Endpoint method="GET" path="/templates/{id}" description="Detail template." />
                        <Endpoint
                            method="POST"
                            path="/templates"
                            description="Buat template baru."
                            params={`{
  "name": "Template Promo",
  "content": "Halo {{nama}}, ada promo {{diskon}}% untuk Anda!",
  "variables": ["nama", "diskon"],
  "category": "promo"
}`}
                        />
                        <Endpoint method="PUT" path="/templates/{id}" description="Update template." />
                        <Endpoint method="DELETE" path="/templates/{id}" description="Hapus template." />
                        <Endpoint
                            method="POST"
                            path="/templates/{id}/preview"
                            description="Preview template dengan variabel."
                            params={`{ "variables": { "nama": "Budi", "diskon": "50" } }`}
                            response={`{ "preview": "Halo Budi, ada promo 50% untuk Anda!", "template": {...} }`}
                        />
                    </Section>

                    {/* Auto-Reply */}
                    <Section id="autoreply" title="🤖 Auto-Reply" icon={Bot}>
                        <Endpoint method="GET" path="/autoreply/rules" description="Daftar aturan auto-reply." params={`# Query: ?sessionId=uuid-session`} />
                        <Endpoint
                            method="POST"
                            path="/autoreply/rules"
                            description="Tambah aturan auto-reply."
                            params={`{
  "sessionId": "uuid-session",
  "name": "Reply Harga",
  "triggerType": "contains",   // contains | exact | startsWith | regex
  "triggerValue": "harga",
  "replyMessage": "Harga produk kami mulai Rp 50.000. Kunjungi website kami!",
  "useAI": false,
  "isActive": true
}`}
                        />
                        <Endpoint method="PUT" path="/autoreply/rules/{id}" description="Update aturan auto-reply." />
                        <Endpoint method="DELETE" path="/autoreply/rules/{id}" description="Hapus aturan auto-reply." />
                        <Endpoint
                            method="GET"
                            path="/autoreply/settings/{sessionId}"
                            description="Pengaturan auto-reply per session."
                            response={`{
  "autoReplyEnabled": true,
  "autoRejectUnknown": false,
  "unknownContactMessage": "Maaf, nomor Anda tidak dikenal.",
  "replyCooldown": 5
}`}
                        />
                        <Endpoint method="POST" path="/autoreply/settings" description="Update pengaturan auto-reply." params={`{
  "sessionId": "uuid-session",
  "autoReplyEnabled": true,
  "replyCooldown": 10
}`} />
                    </Section>

                    {/* Anti-Block */}
                    <Section id="antiblock" title="🛡️ Anti-Block Settings" icon={Shield}>
                        <Endpoint
                            method="GET"
                            path="/antiblock/settings"
                            description="Lihat pengaturan anti-block global."
                            response={`{
  "rateLimitEnabled": true,
  "messagesPerMinute": 5,
  "messagesPerHour": 50,
  "burstLimit": 10,
  "delayEnabled": true,
  "minDelay": 1,
  "maxDelay": 5,
  "baseDelay": 2,
  "warmupEnabled": true,
  "warmupDays": 7,
  "spintaxEnabled": true,
  "numberFilterEnabled": true
}`}
                        />
                        <Endpoint
                            method="POST"
                            path="/antiblock/settings"
                            description="Update pengaturan anti-block."
                            params={`{
  "rateLimitEnabled": true,
  "messagesPerMinute": 3,
  "messagesPerHour": 30,
  "minDelay": 2,
  "maxDelay": 8
}`}
                        />
                        <Endpoint method="POST" path="/antiblock/settings/reset" description="Reset pengaturan ke default." />
                    </Section>

                    {/* Analytics */}
                    <Section id="analytics" title="📈 Analytics" icon={BarChart3}>
                        <Endpoint method="GET" path="/analytics/dashboard" description="Ringkasan statistik dashboard." response={`{
  "totalSessions": 5,
  "activeSessions": 3,
  "totalMessages": 10000,
  "messagesToday": 250
}`} />
                        <Endpoint method="GET" path="/analytics/messages" description="Statistik pengiriman pesan per hari." params={`# Query: ?sessionId=uuid-session&days=7`} />
                        <Endpoint method="GET" path="/analytics/hourly" description="Aktivitas per jam." params={`# Query: ?sessionId=uuid-session&hours=24`} />
                        <Endpoint method="GET" path="/stats" description="Statistik global sistem (total, pending, completed, failed)." />
                    </Section>

                    {/* Session Pool */}
                    <Section id="pool" title="⚡ Session Pool (Multi-Device)" icon={Zap}>
                        <p className="text-sm text-gray-600 mb-4">Gunakan multiple session secara otomatis dengan load balancing.</p>
                        <Endpoint method="GET" path="/pool/status" description="Status dan statistik session pool." />
                        <Endpoint method="GET" path="/pool/sessions" description="Daftar session aktif dalam pool." />
                        <Endpoint method="GET" path="/pool/best-session" description="Dapatkan session terbaik saat ini (load balancing)." />
                        <Endpoint
                            method="POST"
                            path="/pool/validate"
                            description="Validasi token session."
                            params={`{ "sessionId": "uuid-session", "token": "wak_xxx" }`}
                            response={`{ "valid": true }`}
                        />
                    </Section>

                    {/* Code Examples */}
                    <Section id="examples" title="💻 Contoh Implementasi" icon={Terminal}>
                        <div className="space-y-5">
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><Terminal className="w-4 h-4" /> cURL</h4>
                                <CodeBlock code={`# Kirim pesan
curl -X POST https://watpm.tpm.co.id/api/v1/messages/send \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: wak_abc123_xxx" \\
  -d '{
    "sessionId": "uuid-session",
    "to": "6281234567890",
    "type": "text",
    "message": "Hello!"
  }'

# Upload file + jadwalkan
curl -X POST https://watpm.tpm.co.id/api/v1/messages/upload-scheduled \\
  -H "X-API-Key: wak_abc123_xxx" \\
  -F "sessionId=uuid-session" \\
  -F "to=6281234567890" \\
  -F "scheduledAt=2024-12-25T01:00:00.000Z" \\
  -F "caption=Laporan bulan ini" \\
  -F "file=@/path/to/report.pdf"`} />
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><FileJson className="w-4 h-4" /> JavaScript / Node.js</h4>
                                <CodeBlock code={`const axios = require('axios');

const api = axios.create({
  baseURL: 'https://watpm.tpm.co.id/api/v1',
  headers: { 'X-API-Key': 'wak_abc123_xxx' }
});

// Kirim pesan teks
async function sendText(to, message) {
  const { data } = await api.post('/messages/send', {
    sessionId: 'uuid-session', to, type: 'text', message, delay: true
  });
  return data;
}

// Upload + jadwalkan
async function scheduleWithFile(to, filePath, scheduledAt) {
  const FormData = require('form-data');
  const fs = require('fs');
  const form = new FormData();
  form.append('sessionId', 'uuid-session');
  form.append('to', to);
  form.append('scheduledAt', scheduledAt);
  form.append('file', fs.createReadStream(filePath));
  
  const { data } = await api.post('/messages/upload-scheduled', form, {
    headers: form.getHeaders()
  });
  return data;
}

// Cek status session
async function checkStatus(sessionId) {
  const { data } = await api.get(\`/sessions/\${sessionId}/qr\`);
  return data.status; // "connected" | "qr" | "connecting" | "disconnected"
}`} />
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-800 mb-2">PHP</h4>
                                <CodeBlock code={`<?php
$apiKey = 'wak_abc123_xxx';
$baseUrl = 'https://watpm.tpm.co.id/api/v1';

// Kirim pesan
function sendMessage($to, $message) {
    global $apiKey, $baseUrl;
    $data = [
        'sessionId' => 'uuid-session',
        'to' => $to,
        'type' => 'text',
        'message' => $message,
        'delay' => true
    ];
    $ch = curl_init("$baseUrl/messages/send");
    curl_setopt_array($ch, [
        CURLOPT_POST => 1,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', "X-API-Key: $apiKey"],
        CURLOPT_RETURNTRANSFER => true
    ]);
    return json_decode(curl_exec($ch), true);
}

echo json_encode(sendMessage('6281234567890', 'Halo dari PHP!'));`} />
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-800 mb-2">Python</h4>
                                <CodeBlock code={`import requests

API_KEY = 'wak_abc123_xxx'
BASE_URL = 'https://watpm.tpm.co.id/api/v1'
headers = {'X-API-Key': API_KEY}

# Kirim pesan
def send_message(to, message):
    return requests.post(f'{BASE_URL}/messages/send', headers=headers, json={
        'sessionId': 'uuid-session',
        'to': to, 'type': 'text', 'message': message, 'delay': True
    }).json()

# Upload + jadwalkan
def schedule_with_file(to, file_path, scheduled_at):
    with open(file_path, 'rb') as f:
        return requests.post(
            f'{BASE_URL}/messages/upload-scheduled',
            headers={'X-API-Key': API_KEY},
            data={'sessionId': 'uuid-session', 'to': to, 'scheduledAt': scheduled_at},
            files={'file': f}
        ).json()

print(send_message('6281234567890', 'Halo dari Python!'))`} />
                            </div>
                        </div>
                    </Section>

                    {/* Error Codes */}
                    <Section id="errors" title="⚠️ Error Codes" icon={AlertCircle}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Code</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {[
                                        ['200', 'OK', 'Request berhasil'],
                                        ['202', 'Accepted', 'Pesan diterima dan masuk antrean'],
                                        ['400', 'Bad Request', 'Parameter kurang, salah, atau scheduledAt di masa lalu'],
                                        ['401', 'Unauthorized', 'API Key tidak valid atau tidak ada'],
                                        ['403', 'Forbidden', 'Tidak memiliki akses (role tidak cukup)'],
                                        ['404', 'Not Found', 'Session, message, atau resource tidak ditemukan'],
                                        ['429', 'Too Many Requests', 'Rate limit terlampaui atau sync terlalu sering'],
                                        ['500', 'Internal Server Error', 'Terjadi kesalahan server'],
                                        ['503', 'Service Unavailable', 'Tidak ada session aktif (session pool kosong)'],
                                    ].map(([code, status, desc]) => (
                                        <tr key={code} className="hover:bg-gray-50">
                                            <td className="px-4 py-3"><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{code}</code></td>
                                            <td className="px-4 py-3 font-medium text-gray-700">{status}</td>
                                            <td className="px-4 py-3 text-gray-600">{desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* Tips */}
                    <Section id="tips" title="💡 Tips & Best Practices" icon={Lightbulb}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <h4 className="font-semibold text-green-800 mb-3">✅ Direkomendasikan</h4>
                                <ul className="space-y-2 text-sm text-green-700">
                                    {[
                                        'Selalu gunakan delay: true saat kirim massal',
                                        'Gunakan Spintax untuk variasi pesan anti-block',
                                        'Validasi nomor sebelum blast',
                                        'Aktifkan Warm-up untuk nomor baru',
                                        'Monitor queue stats secara berkala',
                                        'Simpan API Key di environment variable',
                                        'Implementasikan exponential backoff saat retry',
                                        'Gunakan webhook untuk notifikasi real-time',
                                        'Jadwalkan blast di luar jam sibuk (08:00–20:00)',
                                    ].map(tip => (
                                        <li key={tip} className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <h4 className="font-semibold text-red-800 mb-3">❌ Hindari</h4>
                                <ul className="space-y-2 text-sm text-red-700">
                                    {[
                                        'Kirim spam tanpa jeda',
                                        'Gunakan nomor baru langsung blast massif',
                                        'Pesan identik berulang ke banyak nomor',
                                        'Abaikan rate limit warning',
                                        'Share API Key ke pihak lain',
                                        'Kirim ke nomor tidak valid tanpa validasi',
                                        'Menyimpan API Key di kode sumber (source code)',
                                        'Polling QR terlalu sering (< 3 detik)',
                                    ].map(tip => (
                                        <li key={tip} className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </Section>

                    {/* Footer */}
                    <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-400 pb-4">
                        <p>WA Gateway API v1.0.0 · Dokumentasi Advanced</p>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default DocsAdvanced
