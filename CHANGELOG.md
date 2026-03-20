# Changelog

All notable changes to **WA Gateway TPM** are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) — versioning is date-based.

---

## [Unreleased]

---

## [2026-03-20] — Fix Session Restore & Missing QR Code

### Fixed
- **QR Code tidak muncul (loading macet terus-menerus)** (`src/connection/manager.ts`)
  - **Root Cause 1**: `wa-multi-session` memiliki `autoLoad: true` secara default, menyebabkan proses mengembalikan session berjalan duluan sebelum `manager.ts` mendaftarkan referensinya ke dalam *memory map*. Hal ini membuat event `onQRUpdated` diabaikan, dan status tidak dikirim ke frontend.
  - **Root Cause 2**: Saat mendeteksi session yang sudah terdaftar, `restoreSessionInternal` memanggil `reconnectSession`, yang ternyata di dalamnya memanggil `deleteSession`. Metode dari pihak ke-3 ini secara fatal menghapus seluruh data kredensial / auth di SQLite. Ini membuat user selalu ter-[logout paksa] saat backend direstart.
  - **Fix 1**: Menonaktifkan `autoLoad: false` di `new Whatsapp({...})`. Semua permulaan session kini sepenuhnya di-handle manual oleh `manager.ts` agar event listener terdaftar dengan urutan yang benar.
  - **Fix 2**: `restoreSessionInternal` tidak lagi menggunakan `reconnectSession`. Sekarang ia mengisi data ke dalam *memory map* `this.sessions` dan memanggil `startSession`. Ini dengan aman memulai koneksi atau memicu pembentukan QR baru tanpa ada kredensial yang terbuang.

---

## [2026-03-20] — Per-Session API Key Isolation Fix

### Fixed
- **Per-session API key bisa melihat session milik akun lain** (`src/api/routes.ts`)
  - `GET /sessions` dengan role `session` (per-session API key) sebelumnya mengembalikan **semua session** karena tidak ada penanganan khusus untuk role ini → `userId = undefined` → query tidak difilter.
  - Fix: Ketika `role === 'session'`, endpoint sekarang hanya return **1 session** milik API key tersebut (di-lookup dari `sessionApiKeyId`).

- **Pesan berhasil terkirim via session lain meskipun session API key disconnected** (`src/api/routes.ts`)
  - `POST /messages/send`: Jika caller menyertakan `sessionId` session lain (misal: superadmin yang connected) di request body, tidak ada pengecekan apakah API key punya izin akses ke session tersebut. Akibatnya pesan terkirim melewati session yang salah.
  - Fix: Tambah validasi cross-session — jika `sessionId` di body ≠ `sessionApiKeyId`, request langsung ditolak dengan **HTTP 403 Forbidden**.

- **Cross-session access di bulk send** (`src/api/routes.ts`)
  - `POST /messages/bulk`: Masalah yang sama dengan `/messages/send`. Tambah validasi cross-session yang sama.

- **Auto-send memilih sembarang session** (`src/api/routes.ts`)
  - `POST /messages/send-auto`: Endpoint ini memilih session terbaik via round-robin dari semua session aktif. Hal ini tidak aman untuk per-session API key karena bisa memilih session milik akun lain.
  - Fix: Per-session API key sekarang mendapat **HTTP 403 Forbidden** saat memanggil endpoint ini. Gunakan `/messages/send` dengan `sessionId` eksplisit.

---

## [2026-03-20] — QR Code Browser Cache Fix

### Fixed
- **QR code tidak muncul setelah session terputus** saat menggunakan browser yang sama (bukan fresh browser)
  - **Root cause**: Browser meng-cache response JSON `GET /sessions/:id/qr` sehingga mengembalikan data lama (qrCode: null) ketika QR baru sudah di-generate di backend.
  - **Fix 1 — Backend** (`src/api/routes.ts`): Tambah header `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` + `Pragma: no-cache` + `Expires: 0` pada endpoint `GET /sessions` dan `GET /sessions/:id/qr`.
  - **Fix 2 — Backend** (`src/api/routes.ts`): Tambah endpoint baru `GET /sessions/:id/qr-image` (public, sebelum auth middleware) yang serve QR code langsung sebagai **PNG bytes**, bukan sebagai data URL dalam JSON. Ini jauh lebih reliable untuk rendering di browser.
  - **Fix 3 — Frontend** (`frontend/src/pages/Sessions.jsx`): `fetchQR` sekarang menggunakan flag `hasQR` dari response JSON, lalu membangun URL gambar `/api/v1/sessions/:id/qr-image?t=<timestamp>`. Timestamp di URL memastikan browser selalu fetch QR terbaru.
  - **Fix 4 — Frontend** (`frontend/src/components/QRModal.jsx`): `<img>` menggunakan URL PNG (bukan data URL). `key={qrCode}` memaksa React re-mount img setiap URL baru (tiap polling). Jika gambar gagal load (imgError), loading spinner muncul dan akan pulih otomatis saat URL baru tiba.
  - **Fix 5 — Backend** (`src/index.ts`): Tambah `Cache-Control` dan `Pragma` ke CORS `allowedHeaders`.
  - **Fix 6 — Frontend** (`frontend/src/pages/Sessions.jsx`): `reconnectSession` sekarang menyertakan `token` dan `apiKey` dari session yang ada ke QR modal.

---

## [2026-03-20] — Session Isolation & Contact Routing Fix

### Fixed
- **Session listing not isolated per account** (`src/api/routes.ts`)
  - `GET /sessions` previously only filtered by `userId` for `role: admin`. Users with `role: superadmin` received all sessions across all accounts (`userId = undefined` → unfiltered query).
  - Both `admin` and `superadmin` now see only sessions belonging to their own `user_id`.
  - Exception: authentication via global API Key (env `API_KEY`) still sees all sessions for backward compatibility (`user.id = 'system'`).

- **Incoming message contacts saved to wrong session** (`src/connection/manager.ts`)
  - Global `onMessageReceived` callback was using a `for...break` loop to pick the *first connected session* regardless of which session actually received the message. This caused contacts to be cross-saved between accounts.
  - Contact saving logic removed from the global callback and moved to a per-session Baileys `messages.upsert` event listener, registered inside `onConnected` per session socket. Each session now only saves contacts from messages it actually receives.

---

## [2026-03-16] — Scheduled Messages Timezone Fix

### Fixed
- **Scheduled messages sent at wrong time** (`src/storage/database-pg.ts`)
  - `TIMESTAMP` columns (`scheduled_at`, `created_at`, `updated_at`) in the `messages` table were stored as naive timestamps without timezone info, causing timezone shifts when Node.js interpreted them.
  - Migrated all three columns to `TIMESTAMPTZ` using `ALTER COLUMN ... TYPE TIMESTAMPTZ USING ... AT TIME ZONE 'UTC'`.
  - Queue manager now correctly compares scheduled times against UTC wall clock.

---

## [2026-03-16] — Contact Name Display Fix

### Fixed
- **Contact names showing as phone numbers** (`src/connection/manager.ts`)
  - `pushName` from WhatsApp was sometimes `undefined`, causing fallback to the phone number string being saved as the contact name.
  - Priority chain updated: `contact.name → verifiedName → notify → pushName → shortName → null` (phone number fallback only for required DB field).
  - Retroactive SQL fix added in migration: `UPDATE contacts SET name = NULL WHERE name = phone` to clean up existing bad records.

---

## [2026-03-16] — QR Code Display Fix

### Fixed
- **QR code not displaying** after session creation
  - QR refresh interval was being cleared prematurely.
  - `GET /sessions/:id/qr` now correctly checks `conn.qrCode` and returns `hasQR: true/false` for frontend to handle display logic.

---

## [2026-03-16] — API Documentation Update

### Changed
- Updated `docs/API-DOKUMENTASI.md` to clarify that **UUID Session** is auto-generated by the backend on session creation — users do not need to manually input it.
- Added examples showing how to retrieve `sessionId` from `POST /sessions` response.

---

## [2026-03-16] — 400 Validation Error Fix (Google Apps Script)

### Fixed
- **HTTP 400 Validation Error** when sending messages from Google Apps Script
  - Zod validation schema for `POST /messages/send` was too strict on certain optional fields.
  - Added proper handling for `sessionId` being passed either in request body or inferred from per-session API key context (`req.sessionApiKeyId`).

---

## [2026-03-13] — Anti-Block & Browser Signature Randomization

### Added
- **Random browser signatures** per session connection to avoid WhatsApp fingerprinting all sessions as the same client.
- **Artificial delay** between messages (configurable via `user_antiblock_settings` table) to simulate human-like sending patterns.
- Per-user anti-block settings stored in `user_antiblock_settings` PostgreSQL table with defaults.

---

## [2026-03-12] — QR Connection Loop Fix

### Fixed
- **QR scan stuck in loading loop**
  - Session restore on server startup was creating duplicate socket connections for sessions already tracked in `wa-multi-session`.
  - Added `restoreSessionWithLock()` with debounce (5s) and `restoreInProgress` map to prevent concurrent restores of the same session.
  - `reconnectInProgress` map added to prevent duplicate reconnect attempts.

---

## [2026-03-10] — WA Gateway Tester Redesign

### Changed
- Redesigned `wa-gateway-tester.html` to resemble a Postman-like API client:
  - Direct Base URL and API Key/Token input fields.
  - Request builder with JSON body editor.
  - Response viewer with status code and formatted JSON output.
  - Quick-template buttons for common API calls (send text, send image, etc.).
  - Session selection auto-populates `sessionId` into the request body.

---

## [Initial Release] — Core System

### Added
- **Backend**: Express + Bun runtime + `wa-multi-session` (Baileys) for WhatsApp connectivity.
- **Database**: PostgreSQL via `pg` pool. Tables: `sessions`, `users`, `messages`, `webhooks`, `webhook_logs`, `templates`, `contacts`, `auto_reply_rules`, `auto_reply_settings`, `analytics_hourly`, `user_antiblock_settings`, `global_settings`.
- **Auth**: JWT-based login (`/api/v1/auth/login`), per-session API keys (`wak_...`), global API key from `.env`.
- **Roles**: `superadmin`, `admin`, `session` (per-session API key scope).
- **Session management**: Create, delete, reconnect, logout, force-refresh status, QR polling.
- **Message queue**: Priority queue with status tracking (`pending → processing → completed/failed`). Scheduled messages via `node-cron`.
- **Webhooks**: Configurable per-user webhook URLs with event filtering and delivery logs.
- **Auto-reply**: Rules engine with keyword triggers per session.
- **Anti-block**: Rate limiting, configurable delays, Spintax support, number filtering.
- **Contact sync**: Bulk upsert from Baileys events (`contacts.upsert`, `chats.upsert`, `messaging-history.set`).
- **Frontend**: Vue/Vite SPA served via PM2 on separate port.
- **Multi-tenant**: Sessions scoped by `user_id`, messages/webhooks/templates isolated per user.
