@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════════════════╗
echo ║      WA Gateway - Windows Setup                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

:: Check Git
echo - Git: 
for /f "tokens=*" %%i in ('git --version 2^>nul') do (
    echo   Found: %%i
    goto :git_ok
)
echo   [ERROR] Git not found!
pause
exit /b 1
:git_ok

:: Check Go
echo - Go: 
for /f "tokens=3" %%i in ('go version 2^>nul') do (
    echo   Found: %%i
    goto :go_ok
)
echo   [ERROR] Go not found!
pause
exit /b 1
:go_ok

:: Check Node
echo - Node.js: 
for /f "tokens=1" %%i in ('node --version 2^>nul') do (
    echo   Found: %%i
    goto :node_ok
)
echo   [ERROR] Node.js not found!
pause
exit /b 1
:node_ok

echo.
echo [OK] All prerequisites found!
echo.

:: Create directories
if not exist "backend\data" mkdir "backend\data"

:: Setup Backend
echo [1/2] Setting up Backend...
cd backend

echo   - Downloading modules...
go mod tidy
if %errorlevel% neq 0 (
    echo [ERROR] Failed!
    pause
    exit /b 1
)

:: Create .env
if not exist ".env" (
    echo   - Creating .env...
    (
        echo SERVER_HOST=localhost
        echo SERVER_PORT=8080
        echo DB_TYPE=sqlite
        echo DB_CONNECTION=./data/wagateway.db
        echo REDIS_ENABLED=false
        echo JWT_SECRET=your-secret-key
        echo ANTIBLOCK_ENABLED=true
        echo RATE_LIMIT_ENABLED=true
        echo MESSAGES_PER_MINUTE=5
        echo MESSAGES_PER_HOUR=50
        echo DELAY_ENABLED=true
        echo MIN_DELAY=1
        echo MAX_DELAY=5
        echo ENV=development
    ) > .env
)

echo   - Building...
go build -o wa-gateway.exe ./cmd/server
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo [OK] Backend ready!
cd ..

:: Setup Frontend
echo [2/2] Setting up Frontend...
cd frontend
echo   - Installing npm packages...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)
echo [OK] Frontend ready!
cd ..

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║              Setup Complete!                           ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Start Backend:
echo   cd backend ^&^& wa-gateway.exe
echo.
echo Start Frontend (new terminal):
echo   cd frontend ^&^& npm run dev
echo.
echo Open: http://localhost:3000
echo.
pause
