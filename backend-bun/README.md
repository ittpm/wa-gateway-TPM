# WA Gateway Backend (Bun + Baileys)

Backend WhatsApp Gateway menggunakan Bun runtime dan Baileys library.

## Features

- ✅ WhatsApp Web API dengan Baileys
- ✅ Multi-device support
- ✅ Message queue dengan anti-block protection
- ✅ Webhook dispatcher
- ✅ SQLite database
- ✅ TypeScript

## Prerequisites

- [Bun](https://bun.sh/) 1.0.0+
- Node.js 18+ (untuk native dependencies)

## Install Bun

```powershell
# Windows
powershell -c "irm bun.sh/install.ps1 | iex"

# Linux/Mac
curl -fsSL https://bun.sh/install | bash
```

## Setup

```powershell
# Install dependencies
bun install

# Create .env file
copy .env.example .env

# Run development
bun run dev

# Run production
bun run start
```

## Build

```powershell
bun run build
```

## API Documentation

Sama dengan versi Go. Lihat `/docs/API.md` di root project.

## Perbedaan dengan Go Version

| Fitur | Bun + Baileys | Go + whatsmeow |
|-------|---------------|----------------|
| WhatsApp Library | Baileys | whatsmeow |
| Runtime | Bun | Go |
| Database | better-sqlite3 | mattn/go-sqlite3 |
| QR Code | qrcode | terminal QR |
| Performa | Sangat cepat | Cepat |

## Keuntungan Bun Version

1. **Lebih mudah di Windows** - Tidak perlu GCC untuk SQLite
2. **Baileys lebih stabil** - Library JavaScript yang mature
3. **Native QR code** - QR code langsung jadi image
4. **Hot reload** - `bun run --watch` untuk development
5. **Satu bahasa** - Frontend dan backend sama-sama TypeScript/JavaScript

## Troubleshooting

### Error: Cannot find module '@whiskeysockets/baileys'
```powershell
bun install @whiskeysockets/baileys
```

### Error: better-sqlite3 native module
```powershell
# Windows
npm install -g windows-build-tools

# Reinstall
rm -rf node_modules bun.lockb
bun install
```

### QR Code tidak muncul
Pastikan folder `data/sessions` writable:
```powershell
mkdir -p data/sessions
```
