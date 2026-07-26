@echo off
chcp 65001 > nul
title Korean Law CLI Launcher

echo ===================================================
echo   Korean Law MCP - Interactive CLI Launcher
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

:: 4. Get API Key
if not "%LAW_OC%"=="" goto :skip_key
echo [INFO] API Key (OC) is required to retrieve law data.
echo You can register for a free key at: https://open.law.go.kr
echo.
set /p LAW_OC="Enter your Law OC API Key: "
:skip_key

echo.
echo ===================================================
echo   Starting Interactive CLI Mode...
echo   - Enter 'exit' or 'q' to quit.
echo   - Type search queries (e.g., Civil Law Article 1)
echo ===================================================
echo.

node build/cli.js interactive

if %errorlevel% neq 0 (
    echo [ERROR] CLI exited with error code %errorlevel%.
)

echo.
echo Process finished.
pause

