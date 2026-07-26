# 대한민국 법률 MCP & AI 통합 대시보드 개발 명세서 (Development Specification)

> **버전**: v2.4.0  
> **최종 수정일**: 2026-07-26  
> **목적**: 대한민국 법제처 Open API 기반 MCP(Model Context Protocol) 서버 및 AI 리스크 진단 웹 서비스의 아키텍처, 핵심 기능, 최근 변경사항 및 추후 개발 로드맵 명세

---

## 1. 프로젝트 개요 (Project Overview)

본 프로젝트는 대한민국 법제처 Open API(42개 데이터 API)를 LLM과 연결하는 **Model Context Protocol(MCP) 서버**이자, 사용자가 자연어 검색 및 AI 법률 리스크 진단을 이용할 수 있는 **웹 대시보드 애플리케이션**입니다.

### 핵심 시스템 구성
1. **MCP Core Server (`src/index.ts`, `src/tool-registry.ts`)**:
   - STDIO 및 Streamable HTTP / SSE 표준 MCP 인터페이스 구현.
   - 총 98개 법률 검색 및 조문 조회, 판례, 행정규칙, 자치법규 도구 제공.
2. **웹 대시보드 서버 (`src/web-server.ts`)**:
   - Express 기반 REST API (`/api/query`, `/api/risk-eval`) 제공.
   - 클라이언트 정적 파일 배포 (`public/`).
3. **Gemini AI & Fallback 엔진 (`src/lib/gemini-client.ts`)**:
   - RAG 스타일의 법률 리스크 평가 및 요약 생성 (Gemini 2.5 Flash / 2.0 Flash 지원).
   - API 키 미설정 또는 네트워크/인증 에러 시 **법제처 데이터 기반의 원문 Fallback 리포트** 자동 전환.
4. **인터랙티브 프론트엔드 (`public/app.js`, `public/index.html`)**:
   - Markdown 렌더링 및 URL / 도구 액션 인터랙티브 링크 자동 변환.
   - Mermaid.js 법률 도메인 시각화 지원.

---

## 2. 모듈별 아키텍처 및 상세 명세 (Module Architecture)

### 2.1 검색 및 라우팅 모듈 (`src/lib/query-router.ts`)
- **역할**: 자연어 질의를 패턴 매칭하여 최적의 MCP 도구로 라우팅.
- **주요 라우팅 규칙**:
  - `법령명` (예: "도로교통법"): `search_law` 또는 `get_law_text`
  - `판례 키워드 / 사건번호` (예: "2024도9537"): `search_precedents` / `get_precedent_text`
  - `지역 + 조례` (예: "서울시 건축 조례"): `region_ordinance`

### 2.2 클라이언트 UI 렌더링 엔진 (`public/app.js`)
*최근 v2.4.0 개선 항목*

1. **OpenAPI 주소 ➔ 대민 웹뷰어 URL 자동 전환 (`linkifyUrls`)**:
   - 법제처 OpenAPI 응답의 `/DRF/lawService.do?target=...` 상대 경로를 캡처.
   - 브라우저 직접 접근 시 발생하던 OpenAPI 인증 에러(`OpenAPI 사용자 인증에 실패하였습니다`)를 방지하기 위해 국가법령정보센터(`https://www.law.go.kr/LSW/...`) 대민 URL로 자동 변환:
     - `target=prec` & `ID=...` ➔ `https://www.law.go.kr/LSW/precInfoP.do?precSeq=...`
     - `target=law` & `MST=...` ➔ `https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=...`
     - `target=ordin` & `MST=...` ➔ `https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=...`
     - `target=admrul` & `MST=...` ➔ `https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=...`
   - UI에는 `[웹 페이지로 보기]` 파란색/초록색 하이퍼링크 스타일로 노출.

2. **도구 추천 액션 자동 클릭 (Event Delegation)**:
   - 검색 결과 리포트 내 포함된 `get_law_text(...)`, `search_precedents(...)` 등의 도구 호출 텍스트를 클릭 가능한 인터랙티브 버튼/스팬으로 변환.
   - 클릭 시 해당 도구 명령어가 상단 `queryInput` 검색창에 즉시 입력되고 검색이 자동으로 실행되는 연동 처리.

### 2.3 Gemini AI 리스크 평가 & Fallback 시스템 (`src/web-server.ts`, `src/lib/gemini-client.ts`)
- **Dual-Path 처리**:
  - Gemini API 키 제공 시: 법제처 관련 규제 조문 1차 수집 ➔ RAG Prompt 생성 ➔ Gemini 모델 호출 ➔ AI 가이드라인 및 리스크 수준(HIGH/MEDIUM/LOW) 산출.
  - Gemini API 키 부재/오류 시: 예외를 포착하여 1차 수집된 법제처 원문 데이터 기반의 Fallback 리포트를 차질 없이 출력.

---

## 3. 파일 및 디렉토리 구조 (File Structure)

```
korean-law-mcp/
├── src/
│   ├── index.ts                # MCP 서버 Entry Point (STDIO/HTTP)
│   ├── web-server.ts          # 대시보드 웹 서버 및 API 라우트 (/api/query, /api/risk-eval)
│   ├── tool-registry.ts        # 98개 법률 도구 레지스트리
│   ├── lib/
│   │   ├── api-client.ts       # 법제처 Open API HTTP 클라이언트
│   │   ├── gemini-client.ts    # Gemini REST API 통합 및 RAG 프롬프트
│   │   ├── query-router.ts     # 자연어 질의 ➔ 도구 라우터 (Pattern Matching)
│   │   ├── xml-parser.ts       # XML ➔ JSON/Markdown 변환기
│   │   └── fetch-with-retry.ts # 타임아웃/재시도 처리 및 URL 마스킹
│   └── tools/                  # 40개 도구 개별 구현체 (search, precedents, ordinance 등)
├── public/
│   ├── index.html              # 대시보드 HTML UI
│   ├── app.js                  # 프론트엔드 비즈니스 로직, linkifyUrls 및 Event Handler
│   └── index.css               # UI 스타일시트
├── docs/
│   ├── DEVELOPMENT_SPEC.md     # 본 개발 명세서
│   ├── ARCHITECTURE.md         # 전체 아키텍처 설계서
│   ├── API.md                  # REST & MCP API 문서
│   └── DEVELOPMENT.md          # 개발 환경 및 기여 가이드
├── package.json
└── tsconfig.json
```

---

## 4. 추후 개발 로드맵 및 개선 과제 (Future Development Roadmap)

### 4.1 의도 라우터 정교화 (`src/lib/query-router.ts`) [우선순위: 높음]
- **문제점**: `region_ordinance` 등 과도하게 광범위한 정규식 패턴이 복합 키워드(예: "서울 지역 재건축")를 오캡처하여 자치법규 조례 검색 실패/에러를 유발하는 현상.
- **개선안**:
  1. 지자체명 + 특정 조례명 키워드("조례", "규칙")가 명시된 경우에만 `region_ordinance`로 분기.
  2. 일반 키워드 복합 검색("서울", "재건축")은 일반 통합 검색(`search_law` 또는 `search_precedents`)으로 분기되도록 폴백 우선순위 조정.

### 4.2 대시보드 UI/UX 고도화 [우선순위: 중간]
- **조문/판례 모달 뷰어 제공**: `[웹 페이지로 보기]` 외부 이동 외에도, 대시보드 내에서 바로 원문을 읽을 수 있는 팝업 모달 뷰어 기능 추가.
- **검색 이력 및 즐겨찾기**: 로컬 스토리지(`localStorage`) 기반 검색 히스토리 및 자주 찾는 법령 즐겨찾기 저장.

### 4.3 Gemini LLM 리스크 분석 고도화 [우선순위: 중간]
- **프롬프트 파이프라인 개편**: 판례 판결 요지 및 별표 서식 데이터까지 포함한 multi-context RAG 프롬프트 구축.
- **스트리밍(Streaming) 응답 도입**: SSE / Server-Sent Events 기반으로 Gemini 생성 응답 실시간 타자 효과(Typing effect) 출력.

### 4.4 자동화 테스트 구축 [우선순위: 보통]
- `public/app.js` 내 `linkifyUrls` 단위 테스트 작성 (Vitest / JSDOM 활용).
- `query-router.ts` 키워드 라우팅 케이스 커버리지 테스트 확장.

---

## 5. 빌드 및 테스트 지침 (Build & Execution Guidelines)

```bash
# 1. 의존성 설치 및 빌드
npm install
npm run build

# 2. 대시보드 웹 서버 실행 (기본 포트: 3000)
npx tsx src/web-server.ts

# 3. 테스트 실행
npm test
```
