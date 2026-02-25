@echo off
echo Starting WA Gateway Backend...
echo.
cd backend
if not exist "wa-gateway.exe" (
    echo [ERROR] Backend not built yet! Please run setup-windows.bat first.
    pause
    exit /b 1
)
wa-gateway.exe
pause
