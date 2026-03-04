import { useState } from 'react'
import { 
  BookOpen, 
  Code, 
  Shield, 
  Smartphone, 
  Webhook, 
  Send, 
  ListOrdered, 
  BarChart3, 
  CheckCircle,
  Terminal,
  FileJson,
  AlertCircle,
  Lightbulb,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react'

// Code block component with copy functionality
function CodeBlock({ code, language = 'bash' }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copyToClipboard}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// Section component
function Section({ id, title, icon: Icon, children }) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <div className="flex items-center gap-3 mb-4 pb-2 border-b border-gray-200">
        {Icon && <Icon className="w-6 h-6 text-whatsapp-600" />}
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

// Endpoint card component
function Endpoint({ method, path, description, params, response }) {
  const methodColors = {
    GET: 'bg-green-100 text-green-700 border-green-200',
    POST: 'bg-blue-100 text-blue-700 border-blue-200',
    PUT: 'bg-amber-100 text-amber-700 border-amber-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200'
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-white hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${methodColors[method] || 'bg-gray-100 text-gray-700'}`}>
          {method}
        </span>
        <code className="text-gray-800 font-mono text-sm">{path}</code>
      </div>
      <p className="text-gray-600 text-sm mb-3">{description}</p>
      
      {params && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">Request Body:</p>
          <CodeBlock code={params} language="json" />
        </div>
      )}
      
      {response && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Response:</p>
          <CodeBlock code={response} language="json" />
        </div>
      )}
    </div>
  )
}

// Table of Contents
function TableOfContents() {
  const sections = [
    { id: 'auth', title: 'Autentikasi', icon: Shield },
    { id: 'sessions', title: 'Sessions', icon: Smartphone },
    { id: 'messages', title: 'Messages', icon: Send },
    { id: 'queue', title: 'Queue', icon: ListOrdered },
    { id: 'webhooks', title: 'Webhooks', icon: Webhook },
    { id: 'antiblock', title: 'Anti-Block', icon: Shield },
    { id: 'stats', title: 'Statistics', icon: BarChart3 },
    { id: 'validation', title: 'Number Validation', icon: CheckCircle },
    { id: 'examples', title: 'Contoh Code', icon: Terminal },
    { id: 'errors', title: 'Error Codes', icon: AlertCircle },
    { id: 'tips', title: 'Tips & Best Practices', icon: Lightbulb },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-4">
      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        Daftar Isi
      </h3>
      <nav className="space-y-1">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-whatsapp-600 rounded-lg transition-colors"
          >
            <section.icon className="w-4 h-4" />
            {section.title}
          </a>
        ))}
      </nav>
    </div>
  )
}

function Docs() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumentasi API</h1>
          <p className="text-gray-500">Panduan lengkap penggunaan WA Gateway API v1.0.0</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            v1.0.0
          </span>
        </div>
      </div>

      {/* Base URL Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Code className="w-4 h-4" />
          Base URL
        </h3>
        <div className="space-y-1 text-sm">
          <p><span className="text-blue-600 font-medium">Development:</span> <code className="bg-blue-100 px-2 py-0.5 rounded">https://watpm.tpm.co.id/api/v1</code></p>
          <p><span className="text-blue-600 font-medium">Production:</span> <code className="bg-blue-100 px-2 py-0.5 rounded">https://watpm.tpm.co.id/api/v1</code></p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="hidden lg:block">
          <TableOfContents />
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Authentication */}
          <Section id="auth" title="🔐 Autentikasi" icon={Shield}>
            <p className="text-gray-600 mb-4">
              Setiap session memiliki token unik yang dihasilkan saat pembuatan. Gunakan token di header:
            </p>
            <CodeBlock code={`X-API-Key: wag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`} />
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Catatan:</strong> Token juga bisa menggunakan JWT Bearer token via Authorization header atau HTTP-only cookie.
              </p>
            </div>
          </Section>

          {/* Sessions */}
          <Section id="sessions" title="📱 Sessions" icon={Smartphone}>
            <p className="text-gray-600 mb-4">Kelola perangkat WhatsApp yang terhubung.</p>
            
            <Endpoint
              method="GET"
              path="/api/v1/sessions"
              description="Mendapatkan daftar semua sessions yang terdaftar."
              response={`[\n  {\n    "id": "uuid-session",\n    "name": "Akun Bisnis 1",\n    "phone": "6281234567890",\n    "status": "connected",\n    "token": "wag_xxxxxxxxxxxxxxxx",\n    "messageCount": 150,\n    "createdAt": "2024-01-15T08:30:00Z",\n    "browser": "Chrome on Windows"\n  }\n]`}
            />
            
            <Endpoint
              method="POST"
              path="/api/v1/sessions"
              description="Membuat session WhatsApp baru."
              params={`{\n  "name": "Akun Bisnis 1"\n}`}
              response={`{\n  "id": "uuid-session",\n  "name": "Akun Bisnis 1",\n  "status": "connecting",\n  "token": "wag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",\n  "message": "Session dibuat. QR code akan tersedia shortly."\n}`}
            />
            
            <Endpoint
              method="GET"
              path="/api/v1/sessions/{id}/qr"
              description="Mendapatkan QR code untuk scan (auto-refresh setiap 20 detik)."
              response={`{\n  "qrCode": "data:image/png;base64,...",\n  "status": "qr",\n  "updatedAt": "2024-01-15T08:30:00Z"\n}`}
            />
            
            <Endpoint
              method="POST"
              path="/api/v1/sessions/{id}/reconnect"
              description="Reconnect session yang terputus."
            />
            
            <Endpoint
              method="POST"
              path="/api/v1/sessions/{id}/logout"
              description="Logout dari WhatsApp."
            />
            
            <Endpoint
              method="DELETE"
              path="/api/v1/sessions/{id}"
              description="Hapus session permanen."
            />
          </Section>

          {/* Messages */}
          <Section id="messages" title="💬 Messages" icon={Send}>
            <p className="text-gray-600 mb-4">Pengiriman pesan WhatsApp.</p>
            
            <Endpoint
              method="POST"
              path="/api/v1/messages/send"
              description="Kirim pesan text."
              params={`{\n  "sessionId": "uuid-session",\n  "to": "6281234567890",\n  "type": "text",\n  "message": "Hello World!",\n  "useSpintax": false,\n  "delay": true\n}`}
              response={`{\n  "messageId": "uuid-message",\n  "status": "queued",\n  "message": "Pesan telah ditambahkan ke antrean"\n}`}
            />
            
            <Endpoint
              method="POST"
              path="/api/v1/messages/send"
              description="Kirim gambar dengan caption."
              params={`{\n  "sessionId": "uuid-session",\n  "to": "6281234567890",\n  "type": "image",\n  "mediaUrl": "https://example.com/image.jpg",\n  "caption": "Lihat gambar ini!",\n  "delay": true\n}`}
            />
            
            <Endpoint
              method="POST"
              path="/api/v1/messages/bulk"
              description="Kirim pesan ke multiple recipients."
              params={`{\n  "sessionId": "uuid-session",\n  "recipients": ["6281234567890", "6289876543210"],\n  "message": "Hello {teman|saudara|rekan}!",\n  "useSpintax": true,\n  "delay": true\n}`}
              response={`{\n  "queued": 3,\n  "messageIds": ["uuid-1", "uuid-2", "uuid-3"],\n  "status": "queued",\n  "message": "3 pesan ditambahkan ke antrean"\n}`}
            />

            <Endpoint
              method="POST"
              path="/api/v1/messages/presence"
              description="Kirim typing indicator (composing/recording/available/unavailable)."
              params={`{\n  "sessionId": "uuid-session",\n  "to": "6281234567890@s.whatsapp.net",\n  "type": "composing"\n}`}
            />
          </Section>

          {/* Queue */}
          <Section id="queue" title="📊 Queue" icon={ListOrdered}>
            <p className="text-gray-600 mb-4">Manajemen antrean pesan.</p>
            
            <Endpoint
              method="GET"
              path="/api/v1/queue"
              description="Lihat daftar pesan dalam antrean."
            />
            
            <Endpoint
              method="GET"
              path="/api/v1/queue/stats"
              description="Statistik antrean."
              response={`{\n  "pending": 10,\n  "processing": 2,\n  "completed": 150,\n  "failed": 3\n}`}
            />
            
            <Endpoint method="POST" path="/api/v1/queue/pause" description="Jeda antrean." />
            <Endpoint method="POST" path="/api/v1/queue/resume" description="Lanjutkan antrean." />
            <Endpoint method="POST" path="/api/v1/queue/retry" description="Retry pesan yang gagal." />
            <Endpoint method="DELETE" path="/api/v1/queue?status=completed" description="Bersihkan antrean berdasarkan status." />
          </Section>

          {/* Webhooks */}
          <Section id="webhooks" title="🔗 Webhooks" icon={Webhook}>
            <p className="text-gray-600 mb-4">Dapatkan notifikasi real-time untuk event.</p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Event yang tersedia:</p>
              <div className="flex flex-wrap gap-2">
                {['message.received', 'message.sent', 'message.delivered', 'message.read', 'message.failed', 'session.connected', 'session.disconnected'].map(event => (
                  <span key={event} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-mono">
                    {event}
                  </span>
                ))}
              </div>
            </div>
            
            <Endpoint
              method="GET"
              path="/api/v1/webhooks"
              description="Daftar semua webhooks."
            />
            
            <Endpoint
              method="POST"
              path="/api/v1/webhooks"
              description="Tambah webhook baru."
              params={`{\n  "url": "https://your-app.com/webhook",\n  "secret": "webhook-secret-key",\n  "events": ["message.received", "message.sent", "message.failed"]\n}`}
            />
            
            <Endpoint method="DELETE" path="/api/v1/webhooks/{id}" description="Hapus webhook." />
            <Endpoint method="GET" path="/api/v1/webhooks/logs" description="Lihat log webhook." />
          </Section>

          {/* Anti-Block */}
          <Section id="antiblock" title="🛡️ Anti-Block Settings" icon={Shield}>
            <p className="text-gray-600 mb-4">Pengaturan perlindungan anti-blokir WhatsApp.</p>
            
            <Endpoint
              method="GET"
              path="/api/v1/antiblock/settings"
              description="Lihat pengaturan anti-block."
              response={`{\n  "rateLimitEnabled": true,\n  "messagesPerMinute": 5,\n  "messagesPerHour": 50,\n  "burstLimit": 10,\n  "delayEnabled": true,\n  "minDelay": 1,\n  "maxDelay": 5,\n  "warmupEnabled": true,\n  "warmupDays": 7,\n  "spintaxEnabled": true,\n  "numberFilterEnabled": true\n}`}
            />
            
            <Endpoint
              method="POST"
              path="/api/v1/antiblock/settings"
              description="Update pengaturan anti-block."
              params={`{\n  "rateLimitEnabled": true,\n  "messagesPerMinute": 3,\n  "messagesPerHour": 30,\n  "minDelay": 2,\n  "maxDelay": 8\n}`}
            />
            
            <Endpoint method="POST" path="/api/v1/antiblock/settings/reset" description="Reset ke default." />

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 mb-2">Fitur Anti-Block</h4>
                <ul className="space-y-2 text-sm text-amber-700">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Random Browser:</strong> Chrome, Firefox, Edge, Safari</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Rate Limiting:</strong> 5 pesan/menit, 50 pesan/jam</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Random Delay:</strong> Jeda acak antar pesan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Warm-up Mode:</strong> Pemanasan nomor baru</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Spintax:</strong> Variasi pesan otomatis</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Format Spintax</h4>
                <CodeBlock code={`Hello {teman|saudara|rekan}, apa kabar?`} />
                <p className="text-sm text-gray-600 mt-2">
                  Akan menghasilkan variasi acak seperti: &quot;Hello teman, apa kabar?&quot; atau &quot;Hello saudara, apa kabar?&quot;
                </p>
              </div>
            </div>
          </Section>

          {/* Stats */}
          <Section id="stats" title="📈 Statistics" icon={BarChart3}>
            <Endpoint
              method="GET"
              path="/api/v1/stats"
              description="Statistik umum sistem."
              response={`{\n  "totalSessions": 5,\n  "activeSessions": 3,\n  "messagesSent": 1000,\n  "messagesQueued": 10,\n  "messagesDelivered": 985,\n  "messagesFailed": 15\n}`}
            />
            
            <Endpoint
              method="GET"
              path="/api/v1/stats/activity"
              description="Data aktivitas 24 jam terakhir untuk grafik."
              response={`[\n  {\n    "time": "14:00",\n    "sent": 45,\n    "delivered": 43,\n    "failed": 2\n  }\n]`}
            />
          </Section>

          {/* Number Validation */}
          <Section id="validation" title="✅ Number Validation" icon={CheckCircle}>
            <Endpoint
              method="POST"
              path="/api/v1/validate-numbers"
              description="Cek apakah nomor terdaftar di WhatsApp."
              params={`{\n  "sessionId": "uuid-session",\n  "numbers": ["6281234567890", "6289876543210"]\n}`}
              response={`{\n  "6281234567890": true,\n  "6289876543210": false\n}`}
            />
          </Section>

          {/* Code Examples */}
          <Section id="examples" title="💻 Contoh Implementasi" icon={Terminal}>
            <div className="space-y-6">
              {/* cURL */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  cURL
                </h4>
                <CodeBlock code={`# Kirim pesan\ncurl -X POST https://watpm.tpm.co.id/api/v1/messages/send \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: wag_xxxxxxxxxxxxxxxx" \\\n  -d '{\n    "sessionId": "uuid-session",\n    "to": "6281234567890",\n    "type": "text",\n    "message": "Hello dari API!"\n  }'`} />
              </div>
              
              {/* JavaScript */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  JavaScript / Node.js
                </h4>
                <CodeBlock code={`const axios = require('axios');\n\nconst client = axios.create({\n  baseURL: 'https://watpm.tpm.co.id/api/v1',\n  headers: { 'X-API-Key': 'wag_xxxxxxxxxxxxxxxx' }\n});\n\n// Kirim pesan\nasync function kirimPesan(to, message) {\n  const response = await client.post('/messages/send', {\n    sessionId: 'uuid-session',\n    to: to,\n    type: 'text',\n    message: message,\n    delay: true\n  });\n  return response.data;\n}\n\n// Bulk message\nasync function kirimBulk(nomorArray, pesan) {\n  const response = await client.post('/messages/bulk', {\n    sessionId: 'uuid-session',\n    recipients: nomorArray,\n    message: pesan,\n    useSpintax: true\n  });\n  return response.data;\n}`} language="javascript" />
              </div>
              
              {/* PHP */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">PHP</h4>
                <CodeBlock code={`<?php\n$apiKey = 'wag_xxxxxxxxxxxxxxxx';\n$baseUrl = 'https://watpm.tpm.co.id/api/v1';\n\n// Kirim pesan\n$data = [\n    'sessionId' => 'uuid-session',\n    'to' => '6281234567890',\n    'type' => 'text',\n    'message' => 'Hello dari PHP!',\n    'delay' => true\n];\n\n$ch = curl_init(\"$baseUrl/messages/send\");\ncurl_setopt($ch, CURLOPT_POST, 1);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));\ncurl_setopt($ch, CURLOPT_HTTPHEADER, [\n    'Content-Type: application/json',\n    \"X-API-Key: $apiKey\"\n]);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n\n$response = curl_exec($ch);\ncurl_close($ch);\n\necho $response;`} language="php" />
              </div>
              
              {/* Python */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Python</h4>
                <CodeBlock code={`import requests\n\napi_key = 'wag_xxxxxxxxxxxxxxxx'\nbase_url = 'https://watpm.tpm.co.id/api/v1'\nheaders = {\n    'X-API-Key': api_key,\n    'Content-Type': 'application/json'\n}\n\n# Kirim pesan\nresponse = requests.post(\n    f'{base_url}/messages/send',\n    headers=headers,\n    json={\n        'sessionId': 'uuid-session',\n        'to': '6281234567890',\n        'type': 'text',\n        'message': 'Hello dari Python!',\n        'delay': True\n    }\n)\n\nprint(response.json())`} language="python" />
              </div>
            </div>
          </Section>

          {/* Error Codes */}
          <Section id="errors" title="⚠️ Error Codes" icon={AlertCircle}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Code</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">400</code></td>
                    <td className="px-4 py-2 text-gray-600">Bad Request - Parameter kurang atau salah</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">401</code></td>
                    <td className="px-4 py-2 text-gray-600">Unauthorized - API Key tidak valid</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">404</code></td>
                    <td className="px-4 py-2 text-gray-600">Not Found - Session atau resource tidak ditemukan</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">429</code></td>
                    <td className="px-4 py-2 text-gray-600">Rate Limit - Terlalu banyak request</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">500</code></td>
                    <td className="px-4 py-2 text-gray-600">Internal Server Error</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Tips */}
          <Section id="tips" title="💡 Tips & Best Practices" icon={Lightbulb}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">✅ Lakukan</h4>
                <ul className="space-y-2 text-sm text-green-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Selalu gunakan delay saat kirim pesan massal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Gunakan Spintax untuk variasi pesan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Validasi nomor sebelum mengirim</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Gunakan Warm-up untuk nomor baru</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Monitor queue stats secara berkala</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 mb-2">❌ Hindari</h4>
                <ul className="space-y-2 text-sm text-red-700">
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Kirim spam ke banyak nomor tanpa jeda</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Gunakan nomor baru langsung kirim massal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Kirim pesan sama persis berulang kali</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Abaikan rate limit warning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Bagikan API Key ke pihak lain</span>
                  </li>
                </ul>
              </div>
            </div>
          </Section>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
            <p>Dokumentasi ini akan terus diupdate. Untuk pertanyaan, silakan buka issue di repository.</p>
            <p className="mt-1">WA Gateway API v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Docs
