# WA Gateway — WhatsApp Multi-Device Gateway

Gateway WhatsApp berbasis **Bun + TypeScript + Baileys** dengan dashboard React. Mendukung multi-session, message queue, webhook, auto-reply, dan perlindungan anti-block.

> 🌐 **Production URL**: https://watpm.tpm.co.id  
> 🔧 **Backend Port**: 9090  
> 🖥️ **Frontend Port**: 9000

---

## Tech Stack

| Komponen | Teknologi |
|---|---|
| **Backend** | Bun + TypeScript + Express + Baileys (wa-multi-session) |
| **Frontend** | React + Vite |
| **Database** | PostgreSQL 14+ |
| **Process Manager** | PM2 |
| **Reverse Proxy** | Nginx |

---

## Struktur Project

```
wa-gateway-TPM/
├── backend-bun/
│   ├── src/
│   │   ├── api/           # Routes & HTTP handlers
│   │   ├── connection/    # WhatsApp connection manager (Baileys)
│   │   ├── middleware/    # Auth (JWT + API Key), rate-limit, upload
│   │   ├── models/        # TypeScript type definitions
│   │   ├── queue/         # Message queue processor
│   │   ├── services/      # Auto-reply, analytics
│   │   ├── storage/       # PostgreSQL database layer
│   │   ├── utils/         # Logger, helpers
│   │   ├── webhook/       # Webhook dispatcher
│   │   └── index.ts       # Entry point
│   ├── .env               # Environment variables (jangan di-commit!)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/         # Sessions, SendMessage, History, dll.
│   │   ├── components/    # QRModal, Layout, dll.
│   │   └── services/      # API client (axios)
│   └── dist/              # Production build (dihasilkan npm run build)
├── docs/
│   ├── API-DOKUMENTASI.md # Dokumentasi API lengkap
│   └── DEPLOYMENT.md      # Panduan deployment lengkap
├── ecosystem.config.js    # PM2 configuration
└── README.md
```

---

## Fitur

### Core
- **Multi-Session** — Jalankan beberapa nomor WhatsApp sekaligus
- **QR Code Login** — Auto-refresh QR, deteksi koneksi otomatis
- **Message Queue** — Antrian pesan dengan retry otomatis (3x)
- **Bulk Messaging** — Kirim ke banyak nomor sekaligus
- **File Upload** — Kirim gambar/dokumen langsung via upload atau URL
- **Pesan Terjadwal** — Schedule pesan ke waktu tertentu
- **Auto-Reply** — Balas otomatis berdasarkan kata kunci atau regex
- **Webhook** — Notifikasi event real-time ke URL eksternal
- **Template Pesan** — Buat dan gunakan template dengan variabel
- **Kontak** — Sinkronisasi kontak dari WhatsApp secara otomatis

### Anti-Block Protection
- **Rate Limiting** — Batas pesan/menit & pesan/jam (configurable)
- **Random Delay** — Jeda acak antar pesan agar terasa alami
- **Warmup Mode** — Naikkan limit bertahap untuk nomor baru
- **Spintax** — Variasi konten pesan: `{Halo|Hi|Selamat Pagi}`
- **Number Validation** — Cek registrasi WA sebelum kirim

### Security
- Autentikasi **JWT** + **API Key** (global dan per-session)
- SSRF protection untuk URL eksternal
- Rate limiting per endpoint
- UUID validation di semua route
- Helmet middleware

---

## Autentikasi API

Ada 3 metode:

| Metode | Header | Keterangan |
|---|---|---|
| **JWT** | `Authorization: Bearer <token>` | Login via dashboard |
| **Global API Key** | `X-API-Key: <key_dari_.env>` | Akses penuh |
| **Per-Session API Key** ⭐ | `X-API-Key: wak_xxxxxx_...` | Terbatas ke 1 sesi |

> ⭐ **Rekomendasi**: Gunakan Per-Session API Key untuk integrasi. `sessionId` tidak perlu disertakan di body pesan — otomatis terdeteksi dari key.

---

## Quick Start (Development)

### 1. Prasyarat

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
npm install -g pm2

# PostgreSQL 14+
sudo apt install -y postgresql postgresql-contrib
```

### 2. Setup Database PostgreSQL

```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE wagateway;
CREATE USER wagatewayuser WITH PASSWORD 'wagateway2024';
GRANT ALL PRIVILEGES ON DATABASE wagateway TO wagatewayuser;
\q
EOF
```

### 3. Konfigurasi `.env`

Edit `backend-bun/.env`:

```env
PORT=9090
HOST=0.0.0.0
NODE_ENV=development

# WAJIB GANTI di production!
JWT_SECRET=ganti-dengan-nilai-random-kuat
API_KEY=ganti-dengan-nilai-random-kuat

CORS_ORIGIN=*

DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=wagatewayuser
DB_PASSWORD=wagateway2024
DB_NAME=wagateway
```

### 4. Install & Jalankan

```bash
# Backend
cd backend-bun
bun install
bun run dev

# Frontend (terminal baru)
cd frontend
npm install
npm run dev
```

### 5. Akses

- **Frontend**: http://localhost:9000
- **Backend API**: http://localhost:9090/api/v1
- **Health Check**: http://localhost:9090/health

**Login default**: username `admin`, password yang diset di `SUPERADMIN_PASSWORD` di `.env` (default: `Admin@1234`)

---

## Production Deployment (PM2)

```bash
# Build Frontend
cd /opt/wa-gateway-TPM/frontend
npm install && npm run build

# Install Backend dependencies
cd /opt/wa-gateway-TPM/backend-bun
bun install

# Start semua service
cd /opt/wa-gateway-TPM
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Perintah PM2 Berguna

```bash
pm2 status                           # Status semua proses
pm2 logs wa-gateway-backend          # Log backend live
pm2 logs wa-gateway-backend --lines 50  # 50 baris terakhir
pm2 restart wa-gateway-backend --update-env  # Restart + load env baru
pm2 restart wa-gateway-frontend      # Restart frontend setelah build
```

---

## Database

Tabel dibuat otomatis saat pertama kali dijalankan via fungsi `migrate()`.

| Tabel | Keterangan |
|---|---|
| `sessions` | Data session WhatsApp |
| `users` | Akun pengguna (superadmin, admin) |
| `messages` | Riwayat & antrian pesan |
| `contacts` | Kontak dari WhatsApp (disync otomatis) |
| `webhooks` | Konfigurasi webhook |
| `webhook_logs` | Log pengiriman webhook |
| `templates` | Template pesan |
| `auto_reply_rules` | Aturan auto-reply |
| `auto_reply_settings` | Pengaturan auto-reply per sesi |
| `user_antiblock_settings` | Konfigurasi anti-block per user |
| `global_settings` | Pengaturan global |
| `analytics_hourly` | Data analitik per jam |

> **Catatan**: Tabel `contacts` memiliki UNIQUE constraint pada `(session_id, jid)` untuk memastikan nama kontak selalu terupdate dengan benar.

---

## Contoh Penggunaan API

### Kirim Pesan (Per-Session Key)

```bash
curl -X POST https://watpm.tpm.co.id/api/v1/messages/send \
  -H "X-API-Key: wak_xxxxxx_your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"to":"6281234567890","type":"text","message":"Halo!"}'
```

### Kirim Bulk

```bash
curl -X POST https://watpm.tpm.co.id/api/v1/messages/bulk \
  -H "X-API-Key: wak_xxxxxx_your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "uuid-session",
    "recipients": ["6281234567890","6289876543210"],
    "message": "{Halo|Hi} {nama}, tagihan bulan ini Rp 150.000",
    "useSpintax": true,
    "delay": true
  }'
```

Lihat [docs/API-DOKUMENTASI.md](docs/API-DOKUMENTASI.md) untuk dokumentasi lengkap semua endpoint.

---

## Troubleshooting

### Backend tidak start
```bash
# Cek PostgreSQL
sudo systemctl status postgresql
# Cek log
pm2 logs wa-gateway-backend --err
```

### QR Code tidak muncul
- Pastikan session baru berhasil dibuat (lihat log: `QR code generated`)
- QR auto-refresh setiap 2 detik via polling
- Jika stuck, klik tombol Refresh di halaman Sessions

### Kontak hanya tampil nomor
- Kontak disync otomatis saat WhatsApp terhubung dan ada pesan masuk
- Nama kontak diambil dari: `contact.name` → `verifiedName` → `notify` → `pushname`
- Jika nama tidak tersedia dari WhatsApp, hanya nomor yang ditampilkan (normal)

### Pesan stuck di queue
```bash
# Cek status session
curl http://localhost:9090/health
# Lihat queue stats
curl -H "X-API-Key: <key>" http://localhost:9090/api/v1/queue/stats
```

### Cek database langsung
```bash
PGPASSWORD=wagateway2024 psql -h localhost -U wagatewayuser -d wagateway
# Cek sessions
SELECT id, name, status, phone FROM sessions;
# Cek kontak
SELECT COUNT(*), session_id FROM contacts GROUP BY session_id;
```

---

## Dokumentasi Lanjutan

- 📚 [Dokumentasi API Lengkap](docs/API-DOKUMENTASI.md)
- 🚀 [Panduan Deployment Production](docs/DEPLOYMENT.md)

---

## License

MIT License
