@echo off
chcp 65001 > nul
title Korean Law Web Launcher

echo ===================================================
echo   Korean Law MCP - Web Dashboard Launcher
echo ===================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: 2. Install Packages
if not exist node_modules (
    echo [INFO] Installing npm packages (first time)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: 3. Build Project
echo [INFO] Building TypeScript files...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Check TypeScript errors above.
    pause
    exit /b 1
)

echo [INFO] Starting Web Dashboard Server...
start "Korean Law Web Server" cmd /k "chcp 65001 > nul && node build/web-server.js"

echo [INFO] Opening browser at http://localhost:3000 ...
timeout /t 2 >nul
start "" "http://localhost:3000"

echo.
echo Server launcher finished. The server is running in the separate console window.
pause
