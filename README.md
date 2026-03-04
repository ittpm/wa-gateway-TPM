# WA Gateway - WhatsApp Multi-Device Gateway

A powerful, anti-block WhatsApp Gateway built with Go/Bun and React. Supports multi-device, message queuing, webhooks, and anti-block protection.

## Backend Options

We provide **TWO** backend implementations:

| Backend | Tech Stack | Best For |
|---------|-----------|----------|
| **backend/** | Go + whatsmeow | Linux/Production |
| **backend-bun/** | Bun + Baileys | Windows/Development ⭐ |

> 💡 **Recommendation for Windows**: Use **Bun backend** - easier setup, better Windows support!

## Quick Start (Windows with Bun - RECOMMENDED)

```powershell
# 1. Run setup
.\setup-bun.bat

# 2. Start backend
cd backend-bun
bun run dev

# 3. Start frontend (new terminal)
cd frontend
npm run dev
```

## Quick Start (Go Backend)

## Features

### Core Features
- **Multi-Device Support**: Run multiple WhatsApp numbers simultaneously
- **Message Queue**: Prevent blocking with intelligent message queuing
- **Webhook Dispatcher**: Real-time event notifications
- **Session Management**: QR code login, auto-reconnect, session persistence

### Anti-Block Protection
- **Smart Rate Limiting**: Configurable messages per minute/hour
- **Random Delays**: Human-like delays between messages
- **Warm-up Mode**: Gradual limit increase for new numbers
- **Content Spinner**: Spintax support for message variation
- **Number Validation**: Check WhatsApp registration before sending

### Message Types
- Text messages (with formatting support)
- Images with captions
- Documents (PDF, etc.)
- Location sharing
- Contact cards (vCards)
- Bulk messaging with anti-block protection

## Project Structure

```
wa-gateway/
├── frontend/           # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
├── backend/            # Go backend
│   ├── cmd/server/     # Main entry point
│   ├── internal/       # Internal packages
│   │   ├── api/        # HTTP handlers & routes
│   │   ├── connection/ # WhatsApp connection manager
│   │   ├── queue/      # Message queue processor
│   │   ├── storage/    # Database operations
│   │   ├── webhook/    # Webhook dispatcher
│   │   └── antiblock/  # Anti-block features
│   └── pkg/            # Public packages
│       ├── spintax/    # Spintax processor
│       └── validator/  # Phone number validator
└── docs/               # Documentation
```

## Quick Start

### Prerequisites

#### For Windows Testing:
- **Go 1.21+** - [Download](https://golang.org/dl/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/download/win)
- **GCC (for SQLite)** - via [MSYS2](https://www.msys2.org/) or [TDM-GCC](https://jmeubank.github.io/tdm-gcc/)

#### For Linux Production:
- **Go 1.21+**
- **Node.js 18+**
- **Build essentials**: `sudo apt-get install build-essential`
- **SQLite3**: `sudo apt-get install sqlite3 libsqlite3-dev`

---

## Step-by-Step Testing on Windows

### Step 1: Clone and Setup

```powershell
# Clone the repository (or extract the zip)
cd wa-gateway

# Create data directory
mkdir backend\data
mkdir backend\cmd\server\data
```

### Step 2: Backend Setup

```powershell
# Navigate to backend
cd backend

# Download Go dependencies
go mod download

# Build the backend
go build -o wa-gateway.exe ./cmd/server

# Create .env file
copy .env.example .env
```

**Edit `.env` file for Windows:**
```env
SERVER_HOST=localhost
SERVER_PORT=9090

DB_TYPE=sqlite
DB_CONNECTION=./data/wagateway.db

REDIS_ENABLED=false

JWT_SECRET=your-secret-key-for-development-only
ANTIBLOCK_ENABLED=true
```

### Step 3: Run Backend

```powershell
# Run the server
.\wa-gateway.exe

# You should see:
# ╔════════════════════════════════════════════════════════╗
# ║           WA Gateway - WhatsApp Multi-Device           ║
# ╚════════════════════════════════════════════════════════╝
# ✓ Database connected
# ✓ Connection manager initialized
# ✓ Message queue initialized
# 🚀 Server starting on http://localhost:9090
```

### Step 4: Frontend Setup

Open a **new PowerShell window**:

```powershell
# Navigate to frontend
cd wa-gateway\frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Frontend should start at http://localhost:9000
```

### Step 5: Access the Application

1. Open browser: http://localhost:9000
2. You should see the Dashboard
3. Go to **Sessions** page to add a WhatsApp account

### Step 6: Connect WhatsApp

1. Click **"New Session"**
2. Enter a name (e.g., "Business Account 1")
3. Click **Create**
4. Scan the QR code with your WhatsApp mobile app:
   - Open WhatsApp → Menu → Linked Devices → Link a Device
   - Scan the QR code displayed
5. Wait for status to change to **"connected"**

### Step 7: Send Test Message

1. Go to **Send Message** page
2. Select your connected session
3. Enter a phone number (format: 6281234567890)
4. Type a message
5. Enable **"Use Anti-Block Delay"** (recommended)
6. Click **Send Message**

### Step 8: Test Anti-Block Features

1. Go to **Anti-Block** page
2. Adjust rate limiting settings:
   - Messages per minute: 5
   - Messages per hour: 50
   - Min delay: 1 second
   - Max delay: 5 seconds
3. Test bulk messaging with multiple recipients

### Step 9: Test Webhooks

1. Go to **Webhooks** page
2. Add a webhook URL (e.g., use [webhook.site](https://webhook.site) for testing)
3. Select events to subscribe (e.g., "Message Received")
4. Send a message to your WhatsApp number
5. Check webhook delivery logs

---

## Deployment on Linux (Ubuntu)

### Step 1: Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y git curl wget build-essential sqlite3 libsqlite3-dev

# Install Go 1.21+
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
rm go1.21.5.linux-amd64.tar.gz

# Add Go to PATH
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
go version
node -v
npm -v
```

### Step 2: Deploy Application

```bash
# Create app directory
sudo mkdir -p /opt/wa-gateway
sudo chown $USER:$USER /opt/wa-gateway
cd /opt/wa-gateway

# Copy your project files (via git clone or scp)
# If using git:
git clone <your-repo-url> .

# Or copy files from local
scp -r wa-gateway/* user@server:/opt/wa-gateway/
```

### Step 3: Build Backend

```bash
cd /opt/wa-gateway/backend

# Download dependencies
go mod download

# Build for production
go build -o wa-gateway ./cmd/server

# Create data directory
mkdir -p data

# Setup environment
sudo cp .env.example /etc/wa-gateway.env
sudo nano /etc/wa-gateway.env
```

**Production `.env` configuration:**
```env
SERVER_HOST=0.0.0.0
SERVER_PORT=9090

DB_TYPE=sqlite
DB_CONNECTION=/opt/wa-gateway/backend/data/wagateway.db

# OR use PostgreSQL for production:
# DB_TYPE=postgres
# DB_CONNECTION="host=localhost user=wagateway password=secret dbname=wagateway port=5432 sslmode=disable"

REDIS_ENABLED=false

API_KEY=your-secure-api-key-here
JWT_SECRET=your-super-secret-jwt-key-change-this

ANTIBLOCK_ENABLED=true
RATE_LIMIT_ENABLED=true
MESSAGES_PER_MINUTE=5
MESSAGES_PER_HOUR=50
BURST_LIMIT=10

DELAY_ENABLED=true
MIN_DELAY=2
MAX_DELAY=5

WARMUP_ENABLED=true
WARMUP_DAYS=7

WEBHOOK_RETRIES=3
WEBHOOK_TIMEOUT=90000

ENV=production
```

### Step 4: Build Frontend

```bash
cd /opt/wa-gateway/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Install serve for static files
sudo npm install -g serve
```

### Step 5: Create Systemd Services

**Backend Service:**
```bash
sudo nano /etc/systemd/system/wa-gateway.service
```

```ini
[Unit]
Description=WA Gateway Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wa-gateway/backend
ExecStart=/opt/wa-gateway/backend/wa-gateway
Restart=on-failure
RestartSec=5
Environment=PATH=/usr/local/go/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
```

**Frontend Service:**
```bash
sudo nano /etc/systemd/system/wa-gateway-frontend.service
```

```ini
[Unit]
Description=WA Gateway Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wa-gateway/frontend
ExecStart=/usr/bin/serve -s dist -l 9000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Step 6: Start Services

```bash
# Set permissions
sudo chown -R www-data:www-data /opt/wa-gateway

# Reload systemd
sudo systemctl daemon-reload

# Start services
sudo systemctl enable wa-gateway
sudo systemctl enable wa-gateway-frontend
sudo systemctl start wa-gateway
sudo systemctl start wa-gateway-frontend

# Check status
sudo systemctl status wa-gateway
sudo systemctl status wa-gateway-frontend

# View logs
sudo journalctl -u wa-gateway -f
```

### Step 7: Configure Nginx (Optional but Recommended)

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/wa-gateway
```

```nginx
server {
    listen 80;
    server_name watpm.tpm.co.id;

    location / {
        proxy_pass http://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:9090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wa-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 8: SSL with Let's Encrypt (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d watpm.tpm.co.id
sudo systemctl reload nginx
```

---

## API Documentation

### Authentication

If `API_KEY` is set, include it in the header:
```
X-API-Key: your-api-key
```

### Sessions

**Create Session:**
```bash
POST /api/v1/sessions
{
  "name": "Business Account 1"
}
```

**Get All Sessions:**
```bash
GET /api/v1/sessions
```

**Reconnect Session:**
```bash
POST /api/v1/sessions/{id}/reconnect
```

**Logout Session:**
```bash
POST /api/v1/sessions/{id}/logout
```

**Delete Session:**
```bash
DELETE /api/v1/sessions/{id}
```

### Messages

**Send Text Message:**
```bash
POST /api/v1/messages/send
{
  "sessionId": "session-id",
  "to": "6281234567890",
  "type": "text",
  "message": "Hello World!",
  "useSpintax": false,
  "delay": true
}
```

**Send Bulk Messages:**
```bash
POST /api/v1/messages/bulk
{
  "sessionId": "session-id",
  "recipients": ["6281234567890", "6289876543210"],
  "message": "Hello {friend|there}!",
  "useSpintax": true,
  "delay": true
}
```

**Validate Numbers:**
```bash
POST /api/v1/validate-numbers
{
  "sessionId": "session-id",
  "numbers": ["6281234567890", "6289876543210"]
}
```

### Queue

**Get Queue:**
```bash
GET /api/v1/queue
```

**Get Queue Stats:**
```bash
GET /api/v1/queue/stats
```

**Pause Queue:**
```bash
POST /api/v1/queue/pause
```

**Resume Queue:**
```bash
POST /api/v1/queue/resume
```

**Retry Failed:**
```bash
POST /api/v1/queue/retry
```

### Webhooks

**Create Webhook:**
```bash
POST /api/v1/webhooks
{
  "url": "https://your-app.com/webhook",
  "secret": "webhook-secret",
  "events": ["message.received", "message.sent"]
}
```

**Get Webhooks:**
```bash
GET /api/v1/webhooks
```

**Delete Webhook:**
```bash
DELETE /api/v1/webhooks/{id}
```

### Stats

**Get Stats:**
```bash
GET /api/v1/stats
```

**Get Activity Data:**
```bash
GET /api/v1/stats/activity
```

---

## Anti-Block Best Practices

1. **Warm-up New Numbers**: Start with low volume (10-20 messages/day) and gradually increase
2. **Use Random Delays**: Always enable delay between messages
3. **Use Spintax**: Vary message content to avoid spam detection
4. **Validate Numbers**: Check if numbers are on WhatsApp before sending
5. **Monitor Queue**: Keep an eye on failed messages and adjust settings
6. **Avoid Bulk Spam**: Don't send to hundreds of numbers immediately
7. **Use Multiple Sessions**: Distribute load across multiple numbers

---

## Troubleshooting

### Backend won't start (Windows)
- Ensure GCC is installed: `gcc --version`
- Check if data directory exists
- Check port 9090 is not in use: `netstat -ano | findstr :9090`

### Frontend won't build
- Clear npm cache: `npm cache clean --force`
- Delete node_modules: `rm -rf node_modules && npm install`

### WhatsApp won't connect
- Check internet connection
- Ensure phone has active WhatsApp
- Try reconnecting session
- Check firewall settings

### Messages stuck in queue
- Check if session is connected
- Verify rate limiting settings
- Check logs for errors

---

## License

MIT License - See LICENSE file for details

## Support

For issues and feature requests, please open an issue on GitHub.
