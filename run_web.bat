@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==================================================
echo   Korean Law Web Dashboard Launcher
echo ==================================================
echo.

if not exist "build\web-server.js" (
    echo [INFO] Building project...
    call npm run build
)

echo [INFO] Starting Web Server...
start "KoreanLawServer" cmd /k "node build/web-server.js"

echo [INFO] Waiting for server to initialize...
timeout /t 2 >nul

echo [INFO] Opening Browser...
start "" "http://localhost:3000"

echo.
echo Server is running at http://localhost:3000
echo You can close this window after browser opens.
pause
