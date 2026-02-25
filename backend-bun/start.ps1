# Script to start WA Gateway Backend
$ErrorActionPreference = "Continue"

cd $PSScriptRoot

Write-Host "========================================" -ForegroundColor Green
Write-Host "  WA Gateway Backend Starter" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if port 8080 is in use
$portInUse = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Port 8080 is already in use. Stopping existing process..." -ForegroundColor Yellow
    Get-Process -Id $portInUse.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 2
}

# Start the server
Write-Host "Starting server on http://localhost:8080" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

bun run src/index.ts
