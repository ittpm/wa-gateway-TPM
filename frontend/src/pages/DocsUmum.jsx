import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    BookOpen,
    Code,
    Shield,
    Smartphone,
    Send,
    Webhook,
    Calendar,
    Zap,
    CheckCircle,
    Terminal,
    FileJson,
    ChevronRight,
    Copy,
    Check,
    ArrowRight,
    BookMarked
} from 'lucide-react'

function CodeBlock({ code, language = 'bash' }) {
    const [copied, setCopied] = useState(false)
    const copyToClipboard = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <div className="relative group">
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                    onClick={copyToClipboard}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                    title="Copy"
                >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    )
}

function Section({ id, title, icon: Icon, badge, children }) {
    return (
        <section id={id} className="mb-10 scroll-mt-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-whatsapp-100">
                {Icon && <div className="w-9 h-9 rounded-xl bg-whatsapp-50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-whatsapp-600" />
                </div>}
                <h2 className="text-xl font-bold text-gray-900 flex-1">{title}</h2>
                {badge && <span className="px-2.5 py-1 bg-whatsapp-100 text-whatsapp-700 text-xs font-semibold rounded-full">{badge}</span>}
            </div>
            {children}
        </section>
    )
}

function StepCard({ step, title, children }) {
    return (
        <div className="flex gap-4 mb-5">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-whatsapp-600 text-white flex items-center justify-center text-sm font-bold">{step}</div>
            <div className="flex-1 pt-1">
                <h4 className="font-semibold text-gray-800 mb-2">{title}</h4>
                {children}
            </div>
        </div>
    )
}

function InfoBox({ type = 'info', children }) {
    const styles = {
        info: 'bg-blue-50 border-blue-200 text-blue-800',
        warning: 'bg-amber-50 border-amber-200 text-amber-800',
        success: 'bg-green-50 border-green-200 text-green-800',
        tip: 'bg-purple-50 border-purple-200 text-purple-800',
    }
    const icons = { info: '💡', warning: '⚠️', success: '✅', tip: '🚀' }
    return (
        <div className={`border rounded-xl p-4 mb-4 text-sm ${styles[type]}`}>
            <span className="mr-2">{icons[type]}</span>{children}
        </div>
    )
}

function DocsUmum() {
    const navigate = useNavigate()
    const [activeSection, setActiveSection] = useState('quickstart')

    const sections = [
        { id: 'quickstart', label: 'Quick Start', icon: Zap },
        { id: 'auth', label: 'Autentikasi', icon: Shield },
        { id: 'send-message', label: 'Kirim Pesan', icon: Send },
        { id: 'check-connection', label: 'Cek Koneksi WA', icon: Smartphone },
        { id: 'get-qr', label: 'Mendapatkan QR Code', icon: Smartphone },
        { id: 'webhook', label: 'Setting Webhook', icon: Webhook },
        { id: 'schedule', label: 'Schedule Message', icon: Calendar },
        { id: 'direct-send', label: 'Kirim Langsung (No Queue)', icon: Zap },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-whatsapp-600" />
                        Dokumentasi API — Umum
                    </h1>
                    <p className="text-gray-500 mt-1">Panduan integrasi dasar WA Gateway untuk aplikasi Anda</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/docs/advanced')}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <BookMarked className="w-4 h-4" />
                        API Advanced
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Base URL */}
            <div className="bg-gradient-to-r from-whatsapp-600 to-whatsapp-700 rounded-xl p-4 text-white">
                <p className="text-sm font-semibold mb-1 opacity-80 flex items-center gap-1"><Code className="w-4 h-4" /> Base URL</p>
                <code className="text-lg font-mono">https://watpm.tpm.co.id/api/v1</code>
                <p className="text-xs opacity-70 mt-1">Ganti dengan domain production Anda saat deploy</p>
            </div>

            {/* Layout: Sidebar + Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="hidden lg:block">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Topik</p>
                        <nav className="space-y-0.5">
                            {sections.map(s => (
                                <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${activeSection === s.id
                                        ? 'bg-whatsapp-50 text-whatsapp-700 font-semibold'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    <s.icon className="w-4 h-4 flex-shrink-0" />
                                    {s.label}
                                </a>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-3 space-y-2">

                    {/* Quick Start */}
                    <Section id="quickstart" title="⚡ Quick Start" icon={Zap} badge="Mulai di sini">
                        <InfoBox type="success">3 langkah untuk mulai kirim pesan dari aplikasi Anda ke WhatsApp.</InfoBox>

                        <StepCard step="1" title="Buat Session WhatsApp">
                            <p className="text-sm text-gray-600 mb-2">Buat session baru dan dapatkan API Key:</p>
                            <CodeBlock code={`POST /api/v1/sessions
Content-Type: application/json
X-API-Key: YOUR_MASTER_API_KEY

{
  "name": "Akun Bisnis Saya"
}

# Response:
{
  "id": "uuid-session",
  "name": "Akun Bisnis Saya",
  "status": "connecting",
  "token": "wak_abc123_...",  ← simpan ini sebagai API Key
  "message": "Session dibuat. Scan QR untuk menghubungkan."
}`} />
                        </StepCard>

                        <StepCard step="2" title="Scan QR Code">
                            <p className="text-sm text-gray-600 mb-2">Ambil QR code dan scan dari HP:</p>
                            <CodeBlock code={`GET /api/v1/sessions/{id}/qr
X-API-Key: wak_abc123_...

# Response:
{
  "qrCode": "data:image/png;base64,...",  ← render sebagai <img> tag
  "status": "qr"
}`} />
                            <p className="text-xs text-gray-500 mt-2">QR auto-refresh setiap 20 detik. Polling endpoint ini sampai <code>status: "connected"</code></p>
                        </StepCard>

                        <StepCard step="3" title="Kirim Pesan Pertama">
                            <p className="text-sm text-gray-600 mb-2">Setelah terhubung, langsung kirim pesan:</p>
                            <CodeBlock code={`POST /api/v1/messages/send
Content-Type: application/json
X-API-Key: wak_abc123_...

{
  "sessionId": "uuid-session",
  "to": "6281234567890",
  "type": "text",
  "message": "Halo dari aplikasi saya! 🎉",
  "delay": true
}

# Response:
{
  "messageId": "uuid-msg",
  "status": "queued",
  "message": "Pesan telah ditambahkan ke antrean"
}`} />
                        </StepCard>
                    </Section>

                    {/* Authentication */}
                    <Section id="auth" title="🔐 Autentikasi" icon={Shield}>
                        <p className="text-sm text-gray-600 mb-4">
                            WA Gateway menggunakan <strong>API Key</strong> per-session. Setiap session memiliki API Key uniknya sendiri.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="border border-gray-200 rounded-xl p-4">
                                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-1">
                                    <Shield className="w-4 h-4 text-blue-500" /> Via Header
                                </h4>
                                <CodeBlock code={`X-API-Key: wak_abc123_xxxxxxxxxxxxxxxx`} />
                                <p className="text-xs text-gray-500 mt-2">Cara paling umum dan direkomendasikan</p>
                            </div>
                            <div className="border border-gray-200 rounded-xl p-4">
                                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-1">
                                    <Shield className="w-4 h-4 text-purple-500" /> Via Bearer Token
                                </h4>
                                <CodeBlock code={`Authorization: Bearer eyJhbGci...`} />
                                <p className="text-xs text-gray-500 mt-2">JWT token dari login dashboard</p>
                            </div>
                        </div>

                        <InfoBox type="warning">
                            <strong>Penting:</strong> Jangan share API Key ke pihak lain. Jika bocor, regenerate via dashboard Settings.
                        </InfoBox>

                        <h4 className="font-semibold text-gray-800 mb-2">Contoh dengan berbagai bahasa:</h4>
                        <CodeBlock code={`# cURL
curl -H "X-API-Key: wak_abc123_xxx" https://watpm.tpm.co.id/api/v1/sessions

# JavaScript / fetch
fetch('/api/v1/sessions', {
  headers: { 'X-API-Key': 'wak_abc123_xxx' }
})

# Python
import requests
headers = {'X-API-Key': 'wak_abc123_xxx'}
requests.get('https://watpm.tpm.co.id/api/v1/sessions', headers=headers)

# PHP
$ch = curl_init();
curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-API-Key: wak_abc123_xxx']);`} />
                    </Section>

                    {/* Kirim Pesan */}
                    <Section id="send-message" title="💬 Cara Kirim Pesan" icon={Send}>
                        <p className="text-sm text-gray-600 mb-4">WA Gateway mendukung berbagai tipe pesan.</p>

                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-blue-100 text-blue-600 text-xs rounded flex items-center justify-center font-bold">T</span>
                                    Pesan Teks
                                </h4>
                                <CodeBlock code={`POST /api/v1/messages/send
{
  "sessionId": "uuid-session",
  "to": "6281234567890",
  "type": "text",
  "message": "Halo! Selamat datang di toko kami 🛍️",
  "delay": true
}`} />
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-purple-100 text-purple-600 text-xs rounded flex items-center justify-center font-bold">📷</span>
                                    Pesan Gambar/Video (via URL)
                                </h4>
                                <CodeBlock code={`POST /api/v1/messages/send
{
  "sessionId": "uuid-session",
  "to": "6281234567890",
  "type": "image",
  "mediaUrl": "https://example.com/promo-banner.jpg",
  "caption": "Promo spesial hari ini! Diskon 50%",
  "delay": true
}`} />
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-orange-100 text-orange-600 text-xs rounded flex items-center justify-center font-bold">📄</span>
                                    Pesan Dokumen (via URL)
                                </h4>
                                <CodeBlock code={`POST /api/v1/messages/send
{
  "sessionId": "uuid-session",
  "to": "6281234567890",
  "type": "document",
  "mediaUrl": "https://example.com/invoice.pdf",
  "fileName": "Invoice-001.pdf",
  "caption": "Invoice bulan ini",
  "delay": true
}`} />
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-green-100 text-green-600 text-xs rounded flex items-center justify-center font-bold">👥</span>
                                    Kirim ke Banyak Nomor (Bulk)
                                </h4>
                                <CodeBlock code={`POST /api/v1/messages/bulk
{
  "sessionId": "uuid-session",
  "recipients": ["6281234567890", "6289876543210", "6285123456789"],
  "message": "Halo {teman|saudara|pelanggan}, ada promo spesial hari ini!",
  "useSpintax": true,
  "delay": true
}

# Spintax → tiap penerima dapat variasi pesan berbeda (anti-block)`} />
                            </div>
                        </div>
                    </Section>

                    {/* Cek Koneksi */}
                    <Section id="check-connection" title="📡 Cek Koneksi WhatsApp" icon={Smartphone}>
                        <p className="text-sm text-gray-600 mb-4">
                            Sebelum kirim pesan, selalu cek apakah session WhatsApp masih terhubung.
                        </p>

                        <CodeBlock code={`# Ambil semua session & status-nya
GET /api/v1/sessions
X-API-Key: wak_abc123_xxx

# Response:
[
  {
    "id": "uuid-session",
    "name": "Akun Bisnis",
    "phone": "6281234567890",
    "status": "connected",   ← "connected" | "disconnected" | "qr" | "connecting"
    "messageCount": 250,
    "createdAt": "2024-01-15T08:30:00Z"
  }
]`} />

                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { status: 'connected', color: 'green', desc: 'Siap kirim pesan' },
                                { status: 'qr', color: 'blue', desc: 'Menunggu scan QR' },
                                { status: 'connecting', color: 'yellow', desc: 'Sedang terhubung' },
                                { status: 'disconnected', color: 'red', desc: 'Perlu reconnect' },
                            ].map(s => (
                                <div key={s.status} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-lg p-3 text-center`}>
                                    <span className={`text-xs font-bold text-${s.color}-700 font-mono`}>{s.status}</span>
                                    <p className={`text-xs text-${s.color}-600 mt-1`}>{s.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Contoh polling status di JavaScript:</h4>
                            <CodeBlock code={`async function waitUntilConnected(sessionId, apiKey) {
  while (true) {
    const res = await fetch(\`/api/v1/sessions/\${sessionId}/qr\`, {
      headers: { 'X-API-Key': apiKey }
    });
    const data = await res.json();
    
    if (data.status === 'connected') {
      console.log('✅ WhatsApp terhubung!');
      break;
    }
    
    console.log('⏳ Status:', data.status, '— cek lagi 3 detik...');
    await new Promise(r => setTimeout(r, 3000));
  }
}`} />
                        </div>
                    </Section>

                    {/* Get QR Code */}
                    <Section id="get-qr" title="📷 Mendapatkan & Menampilkan QR Code" icon={Smartphone}>
                        <p className="text-sm text-gray-600 mb-4">
                            QR Code diperlukan sekali saat pertama kali menghubungkan nomor WhatsApp.
                        </p>

                        <StepCard step="1" title="Request QR Code">
                            <CodeBlock code={`GET /api/v1/sessions/{sessionId}/qr
X-API-Key: wak_abc123_xxx

# Response:
{
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "status": "qr",
  "updatedAt": "2024-01-15T08:30:00Z",
  "hasQR": true
}`} />
                        </StepCard>

                        <StepCard step="2" title="Render QR di Aplikasi Web">
                            <CodeBlock code={`<!-- HTML -->
<img id="qr-image" src="" alt="Scan QR dengan WhatsApp" />

// JavaScript: poll QR setiap 5 detik
async function pollQR(sessionId, apiKey) {
  const interval = setInterval(async () => {
    const res = await fetch(\`/api/v1/sessions/\${sessionId}/qr\`, {
      headers: { 'X-API-Key': apiKey }
    });
    const data = await res.json();
    
    if (data.hasQR) {
      document.getElementById('qr-image').src = data.qrCode;
    }
    
    if (data.status === 'connected') {
      clearInterval(interval);
      alert('WhatsApp berhasil terhubung!');
    }
  }, 5000); // 5 detik
}`} />
                        </StepCard>

                        <InfoBox type="info">
                            QR Code otomatis expired dan diperbarui setiap ~20 detik. Pastikan aplikasi Anda polling secara berkala.
                        </InfoBox>
                    </Section>

                    {/* Webhook Setup */}
                    <Section id="webhook" title="🔗 Setting Webhook" icon={Webhook}>
                        <p className="text-sm text-gray-600 mb-4">
                            Webhook memungkinkan server Anda menerima notifikasi real-time saat ada pesan masuk, pesan terkirim, dll.
                        </p>

                        <StepCard step="1" title="Daftarkan URL Webhook Anda">
                            <CodeBlock code={`POST /api/v1/webhooks
X-API-Key: wak_abc123_xxx
Content-Type: application/json

{
  "url": "https://your-app.com/webhook/whatsapp",
  "secret": "rahasia-webhook-saya",
  "events": [
    "message.received",
    "message.sent",
    "message.failed",
    "session.connected",
    "session.disconnected"
  ]
}`} />
                        </StepCard>

                        <StepCard step="2" title="Terima & Proses Payload Webhook">
                            <p className="text-sm text-gray-600 mb-2">Server Anda perlu menerima POST request dari WA Gateway:</p>
                            <CodeBlock code={`// Contoh payload yang diterima saat ada pesan masuk:
{
  "event": "message.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "uuid-session",
  "data": {
    "from": "6281234567890",
    "message": "Halo, saya mau pesan!",
    "type": "text",
    "timestamp": 1705312200
  }
}

// Contoh di Node.js / Express:
app.post('/webhook/whatsapp', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'message.received') {
    console.log('Pesan dari:', data.from);
    console.log('Isi pesan:', data.message);
    // Proses pesan di sini...
  }
  
  res.status(200).json({ received: true });
});`} />
                        </StepCard>

                        <StepCard step="3" title="Verifikasi Signature (Opsional tapi Direkomendasikan)">
                            <CodeBlock code={`// WA Gateway mengirim header X-Webhook-Signature
// Verifikasi dengan secret yang Anda daftarkan:

const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return \`sha256=\${expected}\` === signature;
}

app.post('/webhook/whatsapp', (req, res) => {
  const sig = req.headers['x-webhook-signature'];
  if (!verifyWebhook(req.body, sig, 'rahasia-webhook-saya')) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Lanjutkan proses...
});`} />
                        </StepCard>

                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Events yang tersedia:</p>
                            <div className="flex flex-wrap gap-2">
                                {['message.received', 'message.sent', 'message.delivered', 'message.read', 'message.failed', 'session.connected', 'session.disconnected'].map(e => (
                                    <code key={e} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">{e}</code>
                                ))}
                            </div>
                        </div>
                    </Section>

                    {/* Schedule Message */}
                    <Section id="schedule" title="📅 Integrasi Schedule Message" icon={Calendar}>
                        <p className="text-sm text-gray-600 mb-4">
                            Jadwalkan pesan untuk dikirim di waktu tertentu — berguna untuk pengingat, promosi terjadwal, dll.
                        </p>

                        <InfoBox type="info">
                            Tambahkan field <code>scheduledAt</code> (format ISO 8601) ke body request pengiriman pesan biasa.
                        </InfoBox>

                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2">📝 Schedule Pesan Teks</h4>
                                <CodeBlock code={`POST /api/v1/messages/send
{
  "sessionId": "uuid-session",
  "to": "6281234567890",
  "type": "text",
  "message": "Selamat pagi! Reminder tagihan bulan ini.",
  "scheduledAt": "2024-12-25T08:00:00+07:00",  ← waktu kirim
  "delay": false
}`} />
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2">📎 Schedule Pesan dengan Attachment (Upload File)</h4>
                                <p className="text-sm text-gray-600 mb-2">Untuk attachment lokal (upload file + schedule):</p>
                                <CodeBlock code={`POST /api/v1/messages/upload-scheduled
Content-Type: multipart/form-data

# Fields:
sessionId  = "uuid-session"
to         = "6281234567890"
caption    = "Laporan bulan ini terlampir"
scheduledAt = "2024-12-25T08:00:00.000Z"   ← ISO format UTC
file       = [binary file / gambar / PDF]

# Response:
{
  "messageId": "uuid-msg",
  "status": "scheduled",
  "fileName": "laporan.pdf",
  "fileType": "document",
  "scheduledAt": "2024-12-25T01:00:00.000Z",
  "message": "File disimpan dan akan dikirim pada 25 Des 2024, 08.00"
}`} />
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2">📋 Lihat Daftar Pesan Terjadwal</h4>
                                <CodeBlock code={`GET /api/v1/queue
X-API-Key: wak_abc123_xxx

# Filter hanya scheduled (pending + punya scheduledAt di masa depan)
# Response array, tiap item memiliki:
{
  "id": "uuid-msg",
  "to": "6281234567890",
  "type": "text",
  "content": "Selamat pagi!",
  "status": "pending",
  "scheduledAt": "2024-12-25T01:00:00Z"
}

# Batalkan pesan terjadwal:
DELETE /api/v1/queue/{messageId}`} />
                            </div>
                        </div>

                        <InfoBox type="tip">
                            File attachment yang di-upload untuk scheduled message otomatis dihapus dari server setelah <strong>30 hari</strong>.
                        </InfoBox>
                    </Section>

                    {/* Direct Send — No Queue */}
                    <Section id="direct-send" title="⚡ Kirim Langsung Tanpa Antrian" icon={Zap}>
                        <p className="text-sm text-gray-600 mb-4">
                            Secara default, semua pesan masuk ke <strong>antrian (queue)</strong> dengan delay anti-block.
                            Jika aplikasi Anda sudah mengatur queue dan anti-block sendiri, gunakan parameter berikut untuk menonaktifkan fitur tersebut.
                        </p>

                        <InfoBox type="warning">
                            <strong>Perhatian:</strong> Menonaktifkan delay meningkatkan risiko nomor WhatsApp diblokir jika mengirim terlalu banyak pesan dalam waktu singkat. Pastikan aplikasi Anda mengelola rate limit sendiri.
                        </InfoBox>

                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2">Nonaktifkan Delay (Tanpa Jeda)</h4>
                                <CodeBlock code={`POST /api/v1/messages/send
{
  "sessionId": "uuid-session",
  "to": "6281234567890",
  "type": "text",
  "message": "Pesan urgent dari sistem!",
  "delay": false   ← set false untuk nonaktifkan random delay
}`} />
                                <p className="text-xs text-gray-500 mt-2">
                                    Pesan tetap masuk queue, namun tanpa tambahan delay acak.
                                </p>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2">Nonaktifkan Antrian (Kirim via Session Pool — Auto Select)</h4>
                                <CodeBlock code={`# Gunakan endpoint send-auto untuk WA Gateway memilih session terbaik:
POST /api/v1/messages/send-auto
{
  "to": "6281234567890",
  "type": "text",
  "message": "OTP Anda: 123456",
  "delay": false    ← kirim langsung tanpa antrian tambahan
}
# sessionId tidak perlu diisi — WA Gateway pilih otomatis`} />
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2">Pause & Resume Antrian Programatik</h4>
                                <CodeBlock code={`# Jeda antrian (misalnya saat maintenance):
POST /api/v1/queue/pause

# Lanjutkan antrian:
POST /api/v1/queue/resume

# Cek status antrian:
GET /api/v1/queue/stats
# Response:
{
  "pending": 5,
  "processing": 1,
  "completed": 200,
  "failed": 2
}`} />
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                            <h4 className="font-semibold text-blue-800 mb-3">📊 Rekomendasi Penggunaan</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="font-semibold text-blue-700 mb-2">✅ Gunakan Queue (delay: true)</p>
                                    <ul className="space-y-1 text-blue-600">
                                        <li className="flex items-start gap-1"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />Blast promo ke banyak nomor</li>
                                        <li className="flex items-start gap-1"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />Notifikasi otomatis yang tidak urgent</li>
                                        <li className="flex items-start gap-1"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />Pengiriman terjadwal</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-semibold text-blue-700 mb-2">⚡ Gunakan Direct (delay: false)</p>
                                    <ul className="space-y-1 text-blue-600">
                                        <li className="flex items-start gap-1"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />OTP / kode verifikasi</li>
                                        <li className="flex items-start gap-1"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />Notifikasi transaksi real-time</li>
                                        <li className="flex items-start gap-1"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />App Anda sudah atur rate limit sendiri</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* Footer */}
                    <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-400 pb-4">
                        <p>WA Gateway API v1.0.0 · Butuh referensi lengkap?</p>
                        <button
                            onClick={() => navigate('/docs/advanced')}
                            className="mt-2 text-whatsapp-600 hover:text-whatsapp-700 font-medium flex items-center gap-1 mx-auto"
                        >
                            Lihat Dokumentasi Advanced <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default DocsUmum
