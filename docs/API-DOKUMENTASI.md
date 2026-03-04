# WA Gateway — Dokumentasi API Lengkap

> Versi: 1.1.0 | Diperbarui: Februari 2025 | Bahasa: Indonesia

---

## 📍 Base URL

```
Development : http://localhost:9090/api/v1
Production  : https://watpm.tpm.co.id/api/v1
Health Check: GET /health
Docs UI     : GET /docs
```

---

## 🔐 Autentikasi

WA Gateway mendukung **3 metode autentikasi**. Pilih sesuai kebutuhan:

| Metode | Header | Akses | Kapan Digunakan |
|--------|--------|-------|-----------------|
| **JWT Token** | `Authorization: Bearer <token>` | Semua fitur | Login via Dashboard |
| **Global API Key** | `X-API-Key: <key_dari_.env>` | Semua fitur | Integrasi sistem lama / admin |
| **Per-Session API Key** ⭐ | `X-API-Key: wak_xxxxxx_...` | Terbatas ke sesi tsb | Integrasi per-klien / multi-tenant |

### ⭐ Per-Session API Key (Direkomendasikan)

Setiap session WhatsApp memiliki API Key unik dengan format:

```
wak_{6char_session_id}_{32hex_random}

Contoh: wak_8926a5_b2872e786a734007b7dda9ab0a096ae9
```

**Cara mendapatkan API Key:**
1. Buka Dashboard → Sessions
2. Setiap card sesi menampilkan API Key dengan tombol **Copy** dan **Regenerate**
3. Atau via API: `GET /api/v1/sessions` → field `apiKey`

**Keunggulan dibanding Global API Key:**
- Setiap klien/pengguna punya key sendiri
- Jika key bocor, hanya 1 sesi yang terancam
- Tidak perlu kirim `sessionId` di body — otomatis terdeteksi dari key
- Key bisa di-regenerate kapan saja tanpa mempengaruhi sesi lain

---

## 📱 Sessions

### 1. List Semua Sessions
```http
GET /api/v1/sessions
Authorization: Bearer <jwt_token>
```

**Response:**
```json
[
  {
    "id": "8926a5b8-cf18-4081-9cdd-c678bd760410",
    "name": "Akun Bisnis 1",
    "phone": "6281234567890",
    "status": "connected",
    "apiKey": "wak_8926a5_b2872e786a734007b7dda9ab0a096ae9",
    "messageCount": 150,
    "createdAt": "2025-01-15T08:30:00Z"
  }
]
```

### 2. Buat Session Baru
```http
POST /api/v1/sessions
Content-Type: application/json
X-API-Key: <global_key>

{
  "name": "Akun Bisnis 1"
}
```

**Response:**
```json
{
  "id": "uuid-session",
  "name": "Akun Bisnis 1",
  "status": "connecting",
  "apiKey": "wak_8926a5_b2872e786a734007b7dda9ab0a096ae9",
  "token": "wag_xxxxxxxx",
  "message": "Session dibuat. QR code akan tersedia shortly."
}
```
> ⚠️ Simpan `apiKey` dengan aman. Ini adalah key untuk integrasi.

### 3. Ambil QR Code
```http
GET /api/v1/sessions/{id}/qr
```

**Response:**
```json
{
  "qrCode": "data:image/png;base64,...",
  "status": "qr",
  "updatedAt": "2025-01-15T08:30:00Z"
}
```

### 4. Regenerate API Key ⭐ (BARU)
```http
POST /api/v1/sessions/{id}/regenerate-key
X-API-Key: <global_key_atau_jwt>
```

**Response:**
```json
{
  "apiKey": "wak_8926a5_46fef61c3d224922ac1211b285781a1c",
  "message": "API key berhasil di-regenerate"
}
```
> ⚠️ Key lama langsung tidak berlaku setelah regenerate!

### 5. Reconnect Session
```http
POST /api/v1/sessions/{id}/reconnect
```

### 6. Logout Session
```http
POST /api/v1/sessions/{id}/logout
```

### 7. Hapus Session
```http
DELETE /api/v1/sessions/{id}
```

### 8. Refresh Status
```http
POST /api/v1/sessions/{id}/refresh
```

---

## 💬 Kirim Pesan

### 9. Kirim Pesan Text

**Cara 1 — Pakai Global Key + sessionId (cara lama):**
```http
POST /api/v1/messages/send
Content-Type: application/json
X-API-Key: test-secret-key-123

{
  "sessionId": "8926a5b8-cf18-4081-9cdd-c678bd760410",
  "to": "6281234567890",
  "type": "text",
  "message": "Hello World!",
  "delay": true
}
```

**Cara 2 — Pakai Per-Session API Key (direkomendasikan):**
```http
POST /api/v1/messages/send
Content-Type: application/json
X-API-Key: wak_8926a5_b2872e786a734007b7dda9ab0a096ae9

{
  "to": "6281234567890",
  "type": "text",
  "message": "Hello World!",
  "delay": true
}
```
> `sessionId` tidak perlu disertakan — otomatis diisi dari API Key! ✅

**Response:**
```json
{
  "messageId": "uuid-message",
  "status": "queued",
  "message": "Pesan telah ditambahkan ke antrean"
}
```

### 10. Kirim Gambar / Video / Dokumen
```http
POST /api/v1/messages/send
Content-Type: application/json
X-API-Key: wak_xxxxx_yyy

{
  "to": "6281234567890",
  "type": "image",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "Lihat gambar ini!",
  "delay": true
}
```

**Parameter `type`:** `text` | `image` | `video` | `document` | `audio` | `sticker`

### 11. Kirim File (Upload Langsung)
```http
POST /api/v1/messages/send-media
Content-Type: multipart/form-data
X-API-Key: wak_xxxxx_yyy

sessionId: <id-session>  (opsional jika pakai per-session key)
to: 6281234567890
caption: Ini file nya
file: <binary_file>
```

### 12. Kirim Bulk / Massal
```http
POST /api/v1/messages/bulk
Content-Type: application/json
X-API-Key: wak_xxxxx_yyy

{
  "sessionId": "uuid-session",
  "recipients": ["6281234567890", "6289876543210"],
  "message": "Halo {teman|saudara|rekan}!",
  "useSpintax": true,
  "delay": true
}
```

**Response:**
```json
{
  "queued": 2,
  "messageIds": ["uuid-1", "uuid-2"],
  "status": "queued",
  "message": "2 pesan ditambahkan ke antrean"
}
```

### 13. Kirim dengan Template
```http
POST /api/v1/messages/send-template
Content-Type: application/json
X-API-Key: wak_xxxxx_yyy

{
  "templateId": "uuid-template",
  "to": "6281234567890",
  "variables": { "nama": "Budi", "tagihan": "150000" }
}
```

---

## 📊 Antrean (Queue)

### 14. Lihat Antrean
```http
GET /api/v1/queue
```

### 15. Statistik Antrean
```http
GET /api/v1/queue/stats
```

**Response:**
```json
{
  "pending": 5,
  "processing": 1,
  "completed": 150,
  "failed": 3
}
```

### 16. Jeda / Lanjutkan / Retry / Bersihkan
```http
POST /api/v1/queue/pause
POST /api/v1/queue/resume
POST /api/v1/queue/retry
DELETE /api/v1/queue?status=completed
```

---

## 🔗 Webhooks

### 17. Tambah Webhook
```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "secret": "webhook-secret",
  "events": ["message.received", "message.sent", "message.failed"]
}
```

**Event tersedia:** `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.failed`, `session.connected`, `session.disconnected`

### 18. Daftar / Hapus / Log Webhook
```http
GET    /api/v1/webhooks
DELETE /api/v1/webhooks/{id}
GET    /api/v1/webhooks/logs
```

---

## 🛡️ Anti-Block Settings

### 19. Lihat / Update Pengaturan
```http
GET  /api/v1/antiblock/settings
POST /api/v1/antiblock/settings
POST /api/v1/antiblock/settings/reset
```

**Body update:**
```json
{
  "rateLimitEnabled": true,
  "messagesPerMinute": 3,
  "messagesPerHour": 30,
  "minDelay": 2,
  "maxDelay": 8,
  "warmupEnabled": true
}
```

---

## 📈 Statistik
```http
GET /api/v1/stats
GET /api/v1/stats/activity
GET /api/v1/analytics/dashboard
GET /api/v1/analytics/messages?sessionId=xxx&days=7
```

---

## 📝 Contoh Integrasi Lengkap

### cURL — Cara Paling Simpel
```bash
# Kirim pesan pakai per-session API key (tanpa sessionId!)
curl -X POST https://your-server:9090/api/v1/messages/send \
  -H "X-API-Key: wak_8926a5_b2872e786a734007b7dda9ab0a096ae9" \
  -H "Content-Type: application/json" \
  -d '{"to":"6281234567890","type":"text","message":"Halo dari API!"}'
```

### Google Apps Script
```javascript
function kirimPesanWA(nomorTujuan, pesan) {
  const WA_GATEWAY = 'https://your-server:9090/api/v1';
  const SESSION_API_KEY = 'wak_8926a5_b2872e786a734007b7dda9ab0a096ae9';

  const payload = JSON.stringify({
    to: nomorTujuan.replace(/[^0-9]/g, ''), // Bersihkan format nomor
    type: 'text',
    message: pesan,
    delay: true
  });

  try {
    const response = UrlFetchApp.fetch(`${WA_GATEWAY}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SESSION_API_KEY
      },
      payload: payload,
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());
    if (result.messageId) {
      return `✅ Terkirim | ID: ${result.messageId}`;
    } else {
      return `❌ Gagal: ${result.error || 'Unknown error'}`;
    }
  } catch (e) {
    return `❌ Error: ${e.message}`;
  }
}

// Contoh penggunaan di Google Sheets
function kirimTagihanBulk() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tagihan');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const nama = data[i][0];
    const noWA = data[i][1];
    const tagihan = data[i][2];
    const status = data[i][3];

    if (status !== 'TERKIRIM' && noWA) {
      const pesan = `Halo ${nama},\n\nTagihan Anda: *Rp ${tagihan.toLocaleString('id-ID')}*\n\nMohon segera dibayarkan. Terima kasih 🙏`;
      const hasil = kirimPesanWA(noWA, pesan);
      sheet.getRange(i + 1, 4).setValue(hasil);
      Utilities.sleep(9000); // Jeda 3 detik antar pesan
    }
  }
}
```

### JavaScript / Node.js
```javascript
const axios = require('axios');

// Buat client dengan per-session API key
const wa = axios.create({
  baseURL: 'http://localhost:9090/api/v1',
  headers: { 'X-API-Key': 'wak_8926a5_b2872e786a734007b7dda9ab0a096ae9' }
});

// Kirim pesan - tanpa perlu sessionId!
async function kirimPesan(to, message) {
  const { data } = await wa.post('/messages/send', {
    to, type: 'text', message, delay: true
  });
  return data.messageId;
}

// Kirim gambar
async function kirimGambar(to, imageUrl, caption = '') {
  const { data } = await wa.post('/messages/send', {
    to, type: 'image', mediaUrl: imageUrl, caption, delay: true
  });
  return data.messageId;
}

// Cek status queue
async function cekQueue() {
  const { data } = await wa.get('/queue/stats');
  return data;
}
```

### PHP
```php
<?php
class WAGateway {
    private $baseUrl;
    private $apiKey;

    public function __construct($baseUrl, $apiKey) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
    }

    private function request($method, $endpoint, $data = null) {
        $ch = curl_init("{$this->baseUrl}/api/v1{$endpoint}");
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                "X-API-Key: {$this->apiKey}"
            ]
        ]);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        $result = json_decode(curl_exec($ch), true);
        curl_close($ch);
        return $result;
    }

    public function kirimPesan($to, $message, $delay = true) {
        return $this->request('POST', '/messages/send', [
            'to' => $to, 'type' => 'text',
            'message' => $message, 'delay' => $delay
        ]);
    }

    public function statusQueue() {
        return $this->request('GET', '/queue/stats');
    }
}

// Penggunaan
$wa = new WAGateway('http://localhost:9090', 'wak_8926a5_b2872e786a734007b7dda9ab0a096ae9');
$result = $wa->kirimPesan('6281234567890', 'Halo dari PHP!');
echo $result['messageId'] ?? $result['error'];
```

### Python
```python
import requests

class WAGateway:
    def __init__(self, base_url: str, api_key: str):
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        })
        self.base_url = base_url.rstrip('/') + '/api/v1'

    def kirim_pesan(self, to: str, message: str, delay: bool = True):
        resp = self.session.post(f'{self.base_url}/messages/send', json={
            'to': to, 'type': 'text', 'message': message, 'delay': delay
        })
        return resp.json()

    def kirim_bulk(self, recipients: list, message: str):
        resp = self.session.post(f'{self.base_url}/messages/bulk', json={
            'recipients': recipients, 'message': message,
            'useSpintax': True, 'delay': True
        })
        return resp.json()

    def status_queue(self):
        return self.session.get(f'{self.base_url}/queue/stats').json()

# Penggunaan
wa = WAGateway('http://localhost:9090', 'wak_8926a5_b2872e786a734007b7dda9ab0a096ae9')
result = wa.kirim_pesan('6281234567890', 'Halo dari Python!')
print(f"Message ID: {result.get('messageId')}")
```

---

## 🛡️ Fitur Anti-Block

| Fitur | Keterangan |
|-------|-----------|
| **Rate Limit** | Default 5 msg/menit, 50 msg/jam |
| **Random Delay** | Jeda acak 1–5 detik antar pesan |
| **Warmup Mode** | Mulai rendah (10/hari) untuk nomor baru |
| **Spintax** | `{halo\|hi\|hey}` → acak pesan otomatis |
| **Number Filter** | Skip nomor tidak valid |

**Contoh Spintax:**
```
{Halo|Selamat Pagi|Hi} {Bapak|Ibu|Kak}, tagihan bulan ini adalah Rp {jumlah}.
```

---

## ⚠️ Error Codes

| Code | Keterangan |
|------|-----------|
| 400 | Bad Request — Parameter kurang/salah |
| 401 | Unauthorized — API Key tidak valid atau sesi tidak ditemukan |
| 403 | Forbidden — Token JWT expired |
| 404 | Not Found — Session/resource tidak ditemukan |
| 408 | Request Timeout |
| 429 | Too Many Requests — Rate limit |
| 500 | Internal Server Error |

---

## 💡 Best Practices

1. **Gunakan Per-Session API Key** untuk setiap integrasi agar isolasi lebih baik
2. **Jangan hardcode API Key** di source code publik — gunakan environment variable
3. **Aktifkan delay** (`"delay": true`) saat kirim pesan massal
4. **Gunakan Spintax** untuk variasi pesan agar tidak terlihat spam
5. **Monitor queue stats** secara berkala untuk detect masalah
6. **Gunakan Webhook** untuk notifikasi real-time status pesan
7. **Warmup nomor baru** minimal 7 hari sebelum kirim massal
8. **Regenerate API Key** jika terjadi kebocoran key

---

*Dokumentasi ini diperbarui setiap ada perubahan fitur. Versi: 1.1.0*
