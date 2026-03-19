# WA Gateway Backend

Backend WhatsApp Gateway dibangun dengan **Bun + TypeScript + Baileys** dan **PostgreSQL**.

## Stack

- **Runtime**: [Bun](https://bun.sh/) 1.0+
- **WhatsApp**: Baileys (wa-multi-session)
- **Database**: PostgreSQL 14+
- **Framework**: Express.js

## Setup Development

```bash
# Install dependencies
bun install

# Buat .env
cp .env.example .env
# Edit .env (lihat README.md utama untuk contoh konfigurasi)

# Jalankan development
bun run dev
```

## Environment Variables

Lihat `.env.example` untuk daftar lengkap. Variabel kritis:

| Variabel | Keterangan |
|---|---|
| `PORT` | Port backend (default: 9090) |
| `JWT_SECRET` | Secret untuk JWT token (wajib ganti di production!) |
| `API_KEY` | Global API key |
| `DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME` | Koneksi PostgreSQL |
| `CORS_ORIGIN` | Domain yang diizinkan (gunakan `*` untuk development) |

## Struktur Kode

```
src/
├── index.ts           # Entry point
├── api/
│   └── routes.ts      # Semua HTTP routes
├── connection/
│   └── manager.ts     # Manajemen koneksi WhatsApp (Baileys)
├── middleware/        # Auth, rate-limit, upload
├── models/types.ts    # TypeScript interfaces
├── queue/             # Message queue processor
├── services/          # Auto-reply, analytics
├── storage/
│   └── database-pg.ts # PostgreSQL database layer
├── utils/             # Logger, helpers
└── webhook/           # Webhook dispatcher
```

## Database

Tabel dibuat otomatis via `migrate()` saat startup. Tidak perlu setup manual.

> **Catatan penting**: Tabel `contacts` menggunakan UNIQUE constraint pada `(session_id, jid)` — ini memastikan sinkronisasi nama kontak berjalan dengan benar.

## API Endpoints

Lihat [../docs/API-DOKUMENTASI.md](../docs/API-DOKUMENTASI.md) untuk dokumentasi lengkap.

Base URL: `http://localhost:9090/api/v1`

## Troubleshooting

### PostgreSQL tidak bisa connect
```bash
sudo systemctl status postgresql
# Pastikan database 'wagateway' sudah dibuat
PGPASSWORD=wagateway2024 psql -h localhost -U wagatewayuser -d wagateway -c '\dt'
```

### Module tidak ditemukan
```bash
rm -rf node_modules bun.lockb
bun install
```
