# Script to start WA Gateway Backend
$ErrorActionPreference = "Continue"

cd $PSScriptRoot

Write-Host "========================================" -ForegroundColor Green
Write-Host "  WA Gateway Backend Starter" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if port 9090 is in use
$portInUse = Get-NetTCPConnection -LocalPort 9090 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Port 9090 is already in use. Stopping existing process..." -ForegroundColor Yellow
    Get-Process -Id $portInUse.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 2
}

# Start the server
Write-Host "Starting server on http://localhost:9090" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

bun run src/index.ts
