# Upgrade Guide - Fix Connection Issues

## Masalah
Error "Stream Errored (conflict)" Code: 440 terus berulang karena:
1. Multiple event listeners saat reconnect
2. Session tidak di-cleanup dengan benar
3. Race condition antara health check dan connection events

## Langkah Upgrade

### 1. Hapus node_modules dan reinstall
```bash
cd backend-bun
rm -rf node_modules bun.lock
bun install
```

### 2. Hapus Session Data Lama
Hapus folder session untuk memastikan clean state:
```bash
# Hapus database SQLite
rm -rf ./sessions
rm -f ./database.db
```

Atau jika ingin preserve data:
```bash
# Backup dulu
mv ./sessions ./sessions.backup
mv ./database.db ./database.db.backup
```

### 3. Restart Backend
```bash
bun run src/index.ts
```

### 4. Reconnect Session
1. Buka web UI
2. Hapus session yang ada (jika masih muncul)
3. Buat session baru dan scan QR

## Perubahan Kode yang Sudah Dilakukan

### 1. Conflict Backoff (manager.ts)
- Exponential backoff: 30s → 60s → 120s → 240s → max 300s
- Jitter ±20% untuk mencegah thundering herd
- Cleanup session sebelum reconnect

### 2. Timeout Protection (manager.ts + manager.ts queue)
- Send message timeout: 30 detik
- File read timeout: 10 detik
- Message processing timeout: 60 detik

### 3. Health Check Improvements
- Skip health check selama 5 menit setelah conflict
- Delay reconnect lebih lama (30s vs 5s) setelah conflict

### 4. Fix Multiple Event Listeners (NEW)
- Track listeners setup per session
- Mencegah setup listeners berulang kali saat reconnect
- Clear tracking saat session dihapus/disconnect

## Jika Masih Bermasalah

### Cek apakah ada multiple instance
```bash
# Windows - cek port 3000 (backend)
netstat -ano | findstr :3000

# Kill process jika ada multiple
# atau gunakan port berbeda di .env
```

### Cek WhatsApp Mobile
- Pastikan tidak ada WhatsApp Web aktif di device lain
- Logout dari semua WhatsApp Web di HP
- Baru scan QR dari wa-gateway

### Enable Debug Logging
Tambahkan di `.env`:
```
DEBUG=baileys:*
```

## Versi Dependencies

Setelah upgrade:
- `wa-multi-session`: ^4.2.3
- `@whiskeysockets/baileys`: ^7.0.0-rc.6
- `music-metadata`: ^11.12.1 (untuk fix error resolve)

## Catatan Penting

Baileys 7.0.0-rc.6 adalah Release Candidate. Jika masih bermasalah, bisa downgrade ke:
```json
"@whiskeysockets/baileys": "6.7.16"
```

Tapi biasanya versi RC lebih stabil untuk handling conflict dan reconnection.
