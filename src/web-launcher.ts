/**
 * Korean Law Web EXE Launcher Entry Point
 * 더블 클릭 시 웹 서버 실행 및 브라우저 자동으로 띄우기
 */

import { exec } from "child_process"
import "./web-server.js"

const PORT = process.env.PORT || 3000
const url = `http://localhost:${PORT}`

console.log(`[INFO] 웹 대시보드 서버를 시작합니다...`)
console.log(`[INFO] 브라우저(${url})를 엽니다.`)

// OS별 브라우저 열기 명령어 처리
const startCmd = process.platform === "win32"
  ? `start ${url}`
  : process.platform === "darwin"
    ? `open ${url}`
    : `xdg-open ${url}`

setTimeout(() => {
  exec(startCmd, (err) => {
    if (err) {
      console.log(`[NOTICE] 브라우저 자동 오픈 실패. 직접 ${url} 주소로 접속해 주세요.`)
    }
  })
}, 1000)
