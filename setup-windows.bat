@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════════════════╗
echo ║      WA Gateway - Windows Setup                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

:: Check prerequisites
echo [PRE-CHECK] Verifying prerequisites...
echo.

:: Check Git
echo - Checking Git...
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git not found! Required for downloading dependencies.
    echo.
    echo Please install Git:
    echo 1. Download from: https://git-scm.com/download/win
    echo 2. Run installer (use default settings)
    echo 3. Reopen terminal and run this script again
    echo.
    echo Alternative: Install Git via winget:
    echo   winget install --id Git.Git -e --source winget
    echo.
    start https://git-scm.com/download/win
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('git --version') do echo [OK] Found: %%i
echo.

:: Check Go
echo - Checking Go...
where go >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Go not found! Please install Go 1.21+ from https://golang.org/dl/
    start https://golang.org/dl/
    pause
    exit /b 1
)
for /f "tokens=3" %%i in ('go version') do echo [OK] Found: %%i
echo.

:: Check Node.js
echo - Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install from https://nodejs.org/
    start https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=1" %%i in ('node --version') do echo [OK] Found: %%i
echo.

:: Check GCC
echo - Checking GCC (for SQLite)...
where gcc >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] GCC not found! SQLite may fail to compile.
    echo Please install TDM-GCC from: https://jmeubank.github.io/tdm-gcc/download/
    echo.
    choice /C YN /M "Continue anyway (may fail)"
    if errorlevel 2 exit /b 1
) else (
    for /f "tokens=*" %%i in ('gcc --version') do (
        echo [OK] Found: %%i
        goto :gcc_found
    )
)
:gcc_found
echo.

:: Create directories
echo [1/6] Creating directories...
if not exist "backend\data" mkdir "backend\data"
if not exist "backend\cmd\server\data" mkdir "backend\cmd\server\data"
echo [OK] Directories created
echo.

:: Setup Backend
echo [2/6] Setting up Backend...
cd backend

echo   - Configuring Go environment...
set GO111MODULE=on
set GOPROXY=https://proxy.golang.org,direct

echo   - Downloading Go modules (this may take several minutes)...
echo.
go mod tidy
if %errorlevel% neq 0 (
    echo [WARNING] go mod tidy failed, trying go mod download...
    go mod download
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to download Go modules
        echo Try running: git config --global http.sslVerify false
        pause
        exit /b 1
    )
)
echo   - Modules downloaded successfully
echo.

:: Create .env if not exists
if not exist ".env" (
    echo   - Creating .env file...
    (
        echo SERVER_HOST=localhost
        echo SERVER_PORT=8080
        echo.
        echo DB_TYPE=sqlite
        echo DB_CONNECTION=./data/wagateway.db
        echo.
        echo REDIS_ENABLED=false
        echo REDIS_URL=redis://localhost:6379/0
        echo.
        echo API_KEY=
        echo JWT_SECRET=your-secret-key-change-in-production
        echo.
        echo ANTIBLOCK_ENABLED=true
        echo RATE_LIMIT_ENABLED=true
        echo MESSAGES_PER_MINUTE=5
        echo MESSAGES_PER_HOUR=50
        echo BURST_LIMIT=10
        echo.
        echo DELAY_ENABLED=true
        echo MIN_DELAY=1
        echo MAX_DELAY=5
        echo.
        echo WARMUP_ENABLED=true
        echo WARMUP_DAYS=7
        echo.
        echo WEBHOOK_RETRIES=3
        echo WEBHOOK_TIMEOUT=30000
        echo.
        echo ENV=development
        echo LOG_LEVEL=info
    ) > .env
    echo [OK] .env file created
) else (
    echo [OK] .env file already exists
)
echo.

echo   - Building backend...
go build -o wa-gateway.exe ./cmd/server
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build backend
    echo.
    echo Common issues:
    echo 1. GCC not installed - Install TDM-GCC
    echo 2. Missing dependencies - Run: go mod download
    pause
    exit /b 1
)
echo [OK] Backend built: wa-gateway.exe
cd ..
echo.

:: Setup Frontend
echo [3/6] Setting up Frontend...
cd frontend

echo   - Installing npm packages (this may take several minutes)...
call npm install 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install npm packages
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed
cd ..
echo.

echo ╔════════════════════════════════════════════════════════╗
echo ║              Setup Complete!                           ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Next steps:
echo.
echo 1. Start Backend (keep this window open):
echo    cd backend
echo    wa-gateway.exe
echo.
echo 2. Start Frontend (Open NEW terminal window):
echo    cd frontend
echo    npm run dev
echo.
echo 3. Open browser: http://localhost:3000
echo.
echo ════════════════════════════════════════════════════════
echo.
choice /C YN /M "Start backend now"
if errorlevel 2 goto :end
if errorlevel 1 (
    cd backend
    wa-gateway.exe
)

:end
pause
