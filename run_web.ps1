# PowerShell script to build and run the Korean Law MCP web dashboard
# 파일: run_web.ps1

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Korean Law MCP - Web Dashboard Launcher" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Node.js 확인
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js가 설치되어 있지 않습니다." -ForegroundColor Red
    Read-Host "엔터 키를 누르면 종료합니다..."
    exit 1
}

# 2. 패키지 설치 확인
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] npm 패키지를 설치 중입니다..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install 실패" -ForegroundColor Red
        Read-Host "엔터 키를 누르면 종료합니다..."
        exit 1
    }
}

# 3. 프로젝트 빌드
Write-Host "[INFO] TypeScript 프로젝트 빌드 중..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 빌드 실패! 위 메시지를 확인하세요." -ForegroundColor Red
    Read-Host "엔터 키를 누르면 종료합니다..."
    exit 1
}

# 4. 웹 서버 실행 (새 터미널 창에서 콘솔 유지)
Write-Host "[INFO] 웹 대시보드 서버를 시작합니다..." -ForegroundColor Green
Start-Process "powershell" -ArgumentList "-NoExit", "-Command", "node build/web-server.js"

# 5. 브라우저에서 대시보드 열기 (포트 3000)
Start-Sleep -Seconds 2
Write-Host "[INFO] 브라우저(http://localhost:3000)를 엽니다..." -ForegroundColor Green
Start-Process "http://localhost:3000"

