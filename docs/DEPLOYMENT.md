# WA Gateway Deployment Guide

## Table of Contents
1. [Docker Deployment](#docker-deployment)
2. [Linux Production Deployment](#linux-production-deployment)
3. [Windows Service Deployment](#windows-service-deployment)
4. [Reverse Proxy Configuration](#reverse-proxy-configuration)
5. [SSL/TLS Setup](#ssltls-setup)
6. [Monitoring](#monitoring)
7. [Backup & Recovery](#backup--recovery)

## Docker Deployment

### Using Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  wa-gateway:
    build: .
    container_name: wa-gateway
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    environment:
      - TZ=Asia/Jakarta
    networks:
      - wa-gateway-network

  frontend:
    build: ./frontend
    container_name: wa-gateway-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8080/api/v1
    networks:
      - wa-gateway-network

  redis:
    image: redis:7-alpine
    container_name: wa-gateway-redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
    networks:
      - wa-gateway-network

volumes:
  redis-data:

networks:
  wa-gateway-network:
    driver: bridge
```

Create `Dockerfile` for backend:

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o wa-gateway ./cmd/server

FROM alpine:latest

RUN apk add --no-cache sqlite-libs ca-certificates

WORKDIR /app
COPY --from=builder /app/wa-gateway .
COPY --from=builder /app/.env .

EXPOSE 8080

CMD ["./wa-gateway"]
```

Create `frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

RUN npm install -g serve

WORKDIR /app
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

Run:

```bash
docker-compose up -d
```

## Linux Production Deployment

### System Requirements
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- 2GB+ RAM
- 10GB+ Disk space

### Installation Steps

1. **Update system:**
```bash
sudo apt update && sudo apt upgrade -y
```

2. **Create user:**
```bash
sudo useradd -r -s /bin/false wagateway
sudo mkdir -p /opt/wa-gateway
sudo chown wagateway:wagateway /opt/wa-gateway
```

3. **Install dependencies:**
```bash
sudo apt install -y curl wget git build-essential sqlite3 nginx certbot python3-certbot-nginx
```

4. **Install Go:**
```bash
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
rm go1.21.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee /etc/profile.d/go.sh
source /etc/profile.d/go.sh
```

5. **Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

6. **Deploy application:**
```bash
cd /opt/wa-gateway
# Copy your application files here
sudo chown -R wagateway:wagateway /opt/wa-gateway
```

7. **Build application:**
```bash
# Backend
sudo -u wagateway bash -c '
cd /opt/wa-gateway/backend
go mod download
go build -o wa-gateway ./cmd/server
'

# Frontend
sudo -u wagateway bash -c '
cd /opt/wa-gateway/frontend
npm ci
npm run build
'
```

8. **Create systemd service:**

`/etc/systemd/system/wa-gateway.service`:
```ini
[Unit]
Description=WA Gateway Backend
After=network.target

[Service]
Type=simple
User=wagateway
WorkingDirectory=/opt/wa-gateway/backend
ExecStart=/opt/wa-gateway/backend/wa-gateway
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wa-gateway

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/wa-gateway-frontend.service`:
```ini
[Unit]
Description=WA Gateway Frontend
After=network.target

[Service]
Type=simple
User=wagateway
WorkingDirectory=/opt/wa-gateway/frontend
ExecStart=/usr/bin/serve -s dist -l 3000
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

9. **Start services:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable wa-gateway wa-gateway-frontend
sudo systemctl start wa-gateway wa-gateway-frontend
```

## Windows Service Deployment

### Using NSSM (Non-Sucking Service Manager)

1. **Download NSSM:**
   - Download from https://nssm.cc/download
   - Extract to `C:\nssm`

2. **Create backend service:**
```powershell
cd C:\nssm\win64
.\nssm.exe install WA-Gateway-Backend
# Set Application path: C:\wa-gateway\backend\wa-gateway.exe
# Set Working directory: C:\wa-gateway\backend

.\nssm.exe start WA-Gateway-Backend
```

3. **Create frontend service:**
```powershell
.\nssm.exe install WA-Gateway-Frontend
# Set Application path: C:\Program Files\nodejs\node.exe
# Set Arguments: C:\Users\[User]\AppData\Roaming\npm\node_modules\serve\build\main.js -s C:\wa-gateway\frontend\dist -l 3000

.\nssm.exe start WA-Gateway-Frontend
```

## Reverse Proxy Configuration

### Nginx

```nginx
upstream wa_gateway_backend {
    server 127.0.0.1:8080;
}

upstream wa_gateway_frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name wa-gateway.yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://wa_gateway_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://wa_gateway_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://wa_gateway_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Apache

```apache
<VirtualHost *:80>
    ServerName wa-gateway.yourdomain.com

    ProxyPreserveHost On
    
    # Frontend
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # API
    ProxyPass /api http://localhost:8080/api
    ProxyPassReverse /api http://localhost:8080/api
    
    # WebSocket
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:8080/$1" [P,L]
</VirtualHost>
```

## SSL/TLS Setup

### Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d wa-gateway.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

### Manual SSL

```bash
# Generate private key
sudo openssl genrsa -out /etc/ssl/private/wa-gateway.key 2048

# Generate CSR
sudo openssl req -new -key /etc/ssl/private/wa-gateway.key -out /tmp/wa-gateway.csr

# Generate self-signed certificate (for testing)
sudo openssl x509 -req -days 365 -in /tmp/wa-gateway.csr -signkey /etc/ssl/private/wa-gateway.key -out /etc/ssl/certs/wa-gateway.crt
```

Update Nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name wa-gateway.yourdomain.com;

    ssl_certificate /etc/ssl/certs/wa-gateway.crt;
    ssl_certificate_key /etc/ssl/private/wa-gateway.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest of configuration
}

server {
    listen 80;
    server_name wa-gateway.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring

### Using PM2 (Node.js Process Manager)

```bash
# Install PM2 and serve (for frontend) globally
sudo npm install -g pm2 serve

# Create ecosystem file
cat > /opt/wa-gateway/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'wa-gateway-backend',
      script: 'src/index.ts',
      interpreter: '/home/ubuntu/.bun/bin/bun', // Ganti dengan path bun Anda (cek dengan 'which bun')
      cwd: '/opt/wa-gateway/backend-bun',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        HOST: '0.0.0.0'
      },
      log_file: '/var/log/wa-gateway/backend.log',
      out_file: '/var/log/wa-gateway/out.log',
      error_file: '/var/log/wa-gateway/error.log'
    },
    {
      name: 'wa-gateway-frontend',
      script: 'serve',
      args: '-s dist -l 3000',
      cwd: '/opt/wa-gateway/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      log_file: '/var/log/wa-gateway/frontend.log'
    }
  ]
};
EOF

# Start with PM2
sudo mkdir -p /var/log/wa-gateway
sudo chown -R $USER:$USER /var/log/wa-gateway

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Health Check Endpoint

The application provides a health check at:
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Uptime Monitoring

Use UptimeRobot or similar service to monitor:
- `https://wa-gateway.yourdomain.com/health` (Backend)
- `https://wa-gateway.yourdomain.com` (Frontend)

## Backup & Recovery

### Automated Backup Script

Create `/opt/wa-gateway/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/backups/wa-gateway"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp /opt/wa-gateway/backend/data/wagateway.db $BACKUP_DIR/wagateway_$DATE.db

# Backup .env
cp /opt/wa-gateway/backend/.env $BACKUP_DIR/env_$DATE

# Backup sessions (if any)
tar -czf $BACKUP_DIR/sessions_$DATE.tar.gz -C /opt/wa-gateway/backend data/

# Cleanup old backups
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

Make executable and schedule:

```bash
chmod +x /opt/wa-gateway/backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /opt/wa-gateway/backup.sh" | sudo crontab -
```

### Recovery

```bash
# Stop services
sudo systemctl stop wa-gateway wa-gateway-frontend

# Restore database
cp /opt/backups/wa-gateway/wagateway_20240101_020000.db /opt/wa-gateway/backend/data/wagateway.db

# Restore .env
cp /opt/backups/wa-gateway/env_20240101_020000 /opt/wa-gateway/backend/.env

# Restore sessions
tar -xzf /opt/backups/wa-gateway/sessions_20240101_020000.tar.gz -C /opt/wa-gateway/backend

# Start services
sudo systemctl start wa-gateway wa-gateway-frontend
```

## Security Hardening

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Fail2Ban

```bash
sudo apt install fail2ban

# Create jail for WA Gateway
sudo tee /etc/fail2ban/jail.local << 'EOF'
[wa-gateway]
enabled = true
port = http,https
filter = wa-gateway
logpath = /var/log/wa-gateway/backend.log
maxretry = 5
bantime = 3600
EOF

sudo systemctl restart fail2ban
```

### API Security

1. Always set a strong `API_KEY` in production
2. Use HTTPS only
3. Implement IP whitelisting if possible
4. Regularly rotate JWT secrets
