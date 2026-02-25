@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════════════════╗
echo ║   WA Gateway Setup - Bun Backend Edition               ║
echo ╚════════════════════════════════════════════════════════╝
echo.

:: Add Bun to PATH if exists
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
)

:: Check Bun
echo - Checking Bun...
bun --version >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Bun not found. Installing...
    powershell -c "irm bun.sh/install.ps1 | iex"
    
    :: Add to PATH
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    
    :: Verify again
    bun --version >nul 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo [WARNING] Bun installed but requires PATH refresh.
        echo.
        echo Please CLOSE this terminal and open a NEW terminal, then run:
        echo   cd wa-gateway
        echo   .\setup-bun.bat
        echo.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%i in ('bun --version') do echo [OK] Found Bun: %%i
echo.

:: Check Node.js (for native deps)
echo - Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js required for native dependencies!
    echo Please install from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Found Node.js: %%i
echo.

:: Create directories
echo [1/3] Creating directories...
if not exist "backend-bun\data" mkdir "backend-bun\data"
if not exist "backend-bun\data\sessions" mkdir "backend-bun\data\sessions"
echo [OK] Directories created
echo.

:: Setup Backend
echo [2/3] Setting up Bun Backend...
cd backend-bun

echo   - Installing dependencies with Bun...
call bun install
if %errorlevel% neq 0 (
    echo [WARNING] bun install failed, trying with npm...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
)
echo [OK] Dependencies installed

:: Create .env
if not exist ".env" (
    echo   - Creating .env file...
    (
        echo PORT=8080
        echo HOST=0.0.0.0
        echo NODE_ENV=development
        echo.
        echo DB_PATH=./data/wagateway.db
        echo.
        echo JWT_SECRET=your-secret-key-change-in-production
        echo.
        echo ANTIBLOCK_ENABLED=true
        echo RATE_LIMIT_ENABLED=true
        echo MESSAGES_PER_MINUTE=5
        echo MESSAGES_PER_HOUR=50
        echo DELAY_ENABLED=true
        echo MIN_DELAY=1
        echo MAX_DELAY=5
    ) > .env
    echo [OK] .env created
)
cd ..
echo.

:: Setup Frontend
echo [3/3] Setting up Frontend...
cd frontend
echo   - Installing npm packages...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)
cd ..
echo.

echo ╔════════════════════════════════════════════════════════╗
echo ║              Setup Complete!                           ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo [Bun Backend - RECOMMENDED for Windows]
echo.
echo Start Backend:
echo   cd backend-bun ^&^& bun run dev
echo.
echo Start Frontend (new terminal):
echo   cd frontend ^&^& npm run dev
echo.
echo Open: http://localhost:3000
echo.
choice /C YN /M "Start Bun backend now"
if errorlevel 2 goto :end
if errorlevel 1 (
    cd backend-bun
    bun run dev
)

:end
pause
