# WA Gateway — Panduan Deployment Production

**Stack**: Bun + TypeScript + Express + Baileys + PostgreSQL + PM2 + Nginx  
**Server**: Ubuntu 20.04+ / Debian 11+, minimal 2GB RAM, 20GB disk  
**Domain production**: https://watpm.tpm.co.id

---

## 1. Prasyarat Server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2 + serve
sudo npm install -g pm2 serve
```

---

## 2. Setup PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

sudo -u postgres psql << 'EOF'
CREATE DATABASE wagateway;
CREATE USER wagatewayuser WITH PASSWORD 'wagateway2024';
GRANT ALL PRIVILEGES ON DATABASE wagateway TO wagatewayuser;
\q
EOF
```

---

## 3. Clone / Update Aplikasi

```bash
# Clone pertama kali
cd /opt
git clone https://github.com/GanishaMGN/wa-gateway-TPM.git
cd wa-gateway-TPM

# Install dependencies
cd backend-bun && bun install && cd ..
cd frontend && npm install && npm run build && cd ..
```

**Update kode:**
```bash
cd /opt/wa-gateway-TPM
git pull origin main

# Rebuild frontend jika ada perubahan UI
cd frontend && npm run build && cd ..

# Restart backend jika ada perubahan backend
pm2 restart wa-gateway-backend --update-env
```

---

## 4. Konfigurasi `.env`

Edit `/opt/wa-gateway-TPM/backend-bun/.env`:

```env
# Server
PORT=9090
HOST=0.0.0.0
NODE_ENV=production

# Security — WAJIB GANTI!
JWT_SECRET=ganti-dengan-nilai-random-yang-kuat
API_KEY=ganti-dengan-nilai-random-yang-kuat
SUPERADMIN_PASSWORD=password-admin-yang-kuat

# CORS
CORS_ORIGIN=https://watpm.tpm.co.id

# Database (PostgreSQL)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=wagatewayuser
DB_PASSWORD=wagateway2024
DB_NAME=wagateway

# Anti-Block
ANTIBLOCK_ENABLED=true
RATE_LIMIT_ENABLED=true
MESSAGES_PER_MINUTE=5
MESSAGES_PER_HOUR=50
BURST_LIMIT=10
DELAY_ENABLED=true
MIN_DELAY=1
MAX_DELAY=5
WARMUP_ENABLED=true
WARMUP_DAYS=7

# Webhook
WEBHOOK_RETRIES=3
WEBHOOK_TIMEOUT=30000
```

**Generate secret kuat:**
```bash
openssl rand -hex 32   # untuk JWT_SECRET
openssl rand -hex 32   # untuk API_KEY
```

---

## 5. Konfigurasi PM2

File `ecosystem.config.js` sudah tersedia di root project. Jalankan:

```bash
cd /opt/wa-gateway-TPM

# Start semua service
pm2 start ecosystem.config.js

# Simpan agar auto-start saat reboot
pm2 save
pm2 startup
# Ikuti instruksi yang muncul
```

### Perintah PM2 Berguna

```bash
pm2 status                                     # Status semua proses
pm2 logs wa-gateway-backend                    # Log backend live
pm2 logs wa-gateway-backend --lines 100        # 100 baris log
pm2 logs wa-gateway-backend --err              # Hanya error
pm2 restart wa-gateway-backend --update-env    # Restart + load ulang .env
pm2 restart wa-gateway-frontend                # Restart frontend (setelah npm run build)
pm2 reload ecosystem.config.js                 # Reload konfigurasi
pm2 monit                                      # Dashboard monitoring real-time
```

---

## 6. Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/wa-gateway
```

```nginx
upstream wa_backend {
    server 127.0.0.1:9090;
}

upstream wa_frontend {
    server 127.0.0.1:9000;
}

server {
    listen 80;
    server_name watpm.tpm.co.id;

    # Redirect ke HTTPS (aktifkan setelah SSL terpasang)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://wa_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://wa_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }

    location /health {
        proxy_pass http://wa_backend;
    }

    location /docs {
        proxy_pass http://wa_backend;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wa-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. SSL/TLS (Let's Encrypt)

```bash
sudo certbot --nginx -d watpm.tpm.co.id

# Test auto-renewal
sudo certbot renew --dry-run
```

Setelah SSL terpasang, aktifkan redirect HTTP → HTTPS di konfigurasi Nginx.

---

## 8. Monitoring & Health Check

```bash
# Backend health
curl http://localhost:9090/health

# Status PostgreSQL
sudo systemctl status postgresql

# Cek koneksi database
PGPASSWORD=wagateway2024 psql -h localhost -U wagatewayuser -d wagateway -c "\dt"

# Cek data sessions
PGPASSWORD=wagateway2024 psql -h localhost -U wagatewayuser -d wagateway \
  -c "SELECT id, name, status, phone FROM sessions;"

# Cek kontak
PGPASSWORD=wagateway2024 psql -h localhost -U wagatewayuser -d wagateway \
  -c "SELECT session_id, COUNT(*) FROM contacts GROUP BY session_id;"
```

---

## 9. Backup & Recovery

### Script Backup Otomatis

Buat `/opt/wa-gateway-TPM/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/wa-gateway"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
PGPASSWORD=wagateway2024 pg_dump -h localhost -U wagatewayuser wagateway \
  > $BACKUP_DIR/wagateway_$DATE.sql
gzip $BACKUP_DIR/wagateway_$DATE.sql

# Backup konfigurasi .env
cp /opt/wa-gateway-TPM/backend-bun/.env $BACKUP_DIR/env_$DATE

# Backup WhatsApp session files
if [ -d "/opt/wa-gateway-TPM/backend-bun/sessions" ]; then
    tar -czf $BACKUP_DIR/wa_sessions_$DATE.tar.gz \
      -C /opt/wa-gateway-TPM/backend-bun sessions/
fi

# Hapus backup lama
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "Backup selesai: $DATE"
```

```bash
chmod +x /opt/wa-gateway-TPM/backup.sh

# Jadwalkan setiap hari jam 02:00
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/wa-gateway-TPM/backup.sh >> /var/log/wa-gateway-backup.log 2>&1") | crontab -
```

### Recovery

```bash
pm2 stop wa-gateway-backend

# Restore database
gunzip -c /opt/backups/wa-gateway/wagateway_<DATE>.sql.gz | \
  PGPASSWORD=wagateway2024 psql -h localhost -U wagatewayuser wagateway

# Restore .env
cp /opt/backups/wa-gateway/env_<DATE> /opt/wa-gateway-TPM/backend-bun/.env

# Restore sessions (opsional)
tar -xzf /opt/backups/wa-gateway/wa_sessions_<DATE>.tar.gz \
  -C /opt/wa-gateway-TPM/backend-bun/

pm2 restart wa-gateway-backend --update-env
```

---

## 10. Security Hardening

```bash
# Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Fail2Ban (proteksi brute-force)
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**Checklist Production:**
- [ ] `JWT_SECRET` diset ke nilai random kuat (`openssl rand -hex 32`)
- [ ] `API_KEY` diset ke nilai random kuat
- [ ] `CORS_ORIGIN` diset ke domain spesifik (bukan `*`)
- [ ] HTTPS aktif dan HTTP redirect ke HTTPS
- [ ] Firewall aktif
- [ ] Backup terjadwal

---

## 11. Troubleshooting

### Backend crash / tidak mau start
```bash
pm2 logs wa-gateway-backend --lines 50 --err
# Cek apakah PostgreSQL berjalan
sudo systemctl status postgresql
```

### QR Code stuck loading
```bash
pm2 logs wa-gateway-backend --lines 30
# Cari "QR code generated" — jika tidak ada, WhatsApp belum generate QR
# Jika ada, periksa apakah frontend bisa reach backend
curl http://localhost:9090/health
```

### Kontak sync tidak berjalan
```bash
# Cek apakah session connected
PGPASSWORD=wagateway2024 psql -h localhost -U wagatewayuser -d wagateway \
  -c "SELECT name, status FROM sessions;"
# Session harus berstatus 'connected'
# Kontak sync berjalan otomatis saat koneksi terbentuk
```

### Frontend tidak terupdate setelah build
```bash
cd /opt/wa-gateway-TPM/frontend
npm run build
pm2 restart wa-gateway-frontend
# Atau clear browser cache (Ctrl+Shift+R)
```
