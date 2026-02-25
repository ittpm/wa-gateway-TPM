# WA Gateway Windows Setup Script
# Run this script in PowerShell as Administrator

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      WA Gateway - Windows Setup Script                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "This script should be run as Administrator for best results."
}

# Function to check if command exists
function Test-Command($Command) {
    return [bool](Get-Command -Name $Command -ErrorAction SilentlyContinue)
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Go
if (Test-Command "go") {
    $goVersion = go version
    Write-Host "✓ Go installed: $goVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Go not found. Please install Go 1.21+ from https://golang.org/dl/" -ForegroundColor Red
    exit 1
}

# Check Node.js
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check npm
if (Test-Command "npm") {
    $npmVersion = npm --version
    Write-Host "✓ npm installed: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "✗ npm not found." -ForegroundColor Red
    exit 1
}

# Check GCC (for SQLite)
if (Test-Command "gcc") {
    $gccVersion = gcc --version | Select-Object -First 1
    Write-Host "✓ GCC installed: $gccVersion" -ForegroundColor Green
} else {
    Write-Host "⚠ GCC not found. SQLite support may fail." -ForegroundColor Yellow
    Write-Host "  Please install GCC via MSYS2 (https://www.msys2.org/) or TDM-GCC" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setting up WA Gateway..." -ForegroundColor Yellow

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Create necessary directories
Write-Host "Creating directories..." -ForegroundColor Gray
New-Item -ItemType Directory -Force -Path "backend\data" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\cmd\server\data" | Out-Null

# Setup Backend
Write-Host ""
Write-Host "Setting up Backend..." -ForegroundColor Yellow
Set-Location "$scriptDir\backend"

Write-Host "Downloading Go dependencies..." -ForegroundColor Gray
go mod download
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to download Go dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Go dependencies downloaded" -ForegroundColor Green

# Create .env file if not exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file..." -ForegroundColor Gray
    @"
SERVER_HOST=localhost
SERVER_PORT=8080

DB_TYPE=sqlite
DB_CONNECTION=./data/wagateway.db

REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379/0

API_KEY=
JWT_SECRET=your-secret-key-change-in-production

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

WEBHOOK_RETRIES=3
WEBHOOK_TIMEOUT=30000

ENV=development
LOG_LEVEL=info
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✓ .env file created" -ForegroundColor Green
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Build backend
Write-Host "Building backend..." -ForegroundColor Gray
go build -o wa-gateway.exe ./cmd/server
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to build backend" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Backend built successfully" -ForegroundColor Green

# Setup Frontend
Write-Host ""
Write-Host "Setting up Frontend..." -ForegroundColor Yellow
Set-Location "$scriptDir\frontend"

Write-Host "Installing npm dependencies..." -ForegroundColor Gray
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install npm dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ npm dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Setup Complete!                           ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start Backend:" -ForegroundColor Yellow
Write-Host "   cd backend" -ForegroundColor White
Write-Host "   .\wa-gateway.exe" -ForegroundColor White
Write-Host ""
Write-Host "2. Start Frontend (in new terminal):" -ForegroundColor Yellow
Write-Host "   cd frontend" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "3. Open browser: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Default API URL: http://localhost:8080" -ForegroundColor Gray
Write-Host ""
