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
    exit /b
)

:: 2. Install Packages
if exist node_modules goto :skip_install
echo [INFO] Installing npm packages (first time)...
call npm install
:skip_install

:: 3. Build Project
if exist build goto :skip_build
echo [INFO] Building TypeScript files...
call npm run build
:skip_build

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

echo.
echo Process finished.
pause
