/**
 * risk-evaluator.ts — 상황 기반 법률 리스크 종합 진단 엔진 (v4.8.0)
 *
 * 사용자가 입력한 문제 상황(situation) 텍스트를 파싱하여 관련 법령,
 * 벌칙/과태료 조항, 대법원 판례 힌트를 탐색하고 법적 위험 요소 및 대응 가이드를 산출합니다.
 */

import { z } from "zod"
import type { LawApiClient } from "../lib/api-client.js"
import type { LooseToolResponse } from "../lib/types.js"
import { searchLaw } from "./search.js"
import { getLawText } from "./law-text.js"
import { searchDecisions } from "./unified-decisions.js"
import { truncateResponse } from "../lib/schemas.js"

export const RiskEvaluatorSchema = z.object({
  situation: z.string().describe("법적 리스크를 분석할 상황 설명 텍스트"),
  domain: z.string().optional().describe("특정 법률 영역 힌트 (예: '임대차', '근로기준', '도로교통', '개인정보', '부정경쟁방지')"),
  apiKey: z.string().optional(),
})

export type RiskEvaluatorInput = z.infer<typeof RiskEvaluatorSchema>

interface RiskFactor {
  category: string
  lawName: string
  articleNo?: string
  description: string
  severity: "HIGH" | "MEDIUM" | "LOW"
}

/**
 * 도메인/키워드 추출 규칙
 */
const DOMAIN_PATTERNS: Array<{ pattern: RegExp; domain: string; defaultLaws: string[] }> = [
  {
    pattern: /전세|월세|보증금|임대차|집주인|세입자|계약금|원상복구/i,
    domain: "임대차",
    defaultLaws: ["주택임대차보호법", "상가건물 임대차보호법", "민법"],
  },
  {
    pattern: /퇴직금|임금|해고|야근|수당|근로시간|주휴수당|퇴사/i,
    domain: "노동/근로",
    defaultLaws: ["근로기준법", "근로자퇴직급여 보장법"],
  },
  {
    pattern: /음주|뺑소니|사고|운전|신호위반|면허|면허취소/i,
    domain: "도로교통",
    defaultLaws: ["도로교통법", "특정범죄 가중처벌 등에 관한 법률"],
  },
  {
    pattern: /개인정보|유출|동의|CCTV|DB|명의도용/i,
    domain: "개인정보",
    defaultLaws: ["개인정보 보호법"],
  },
  {
    pattern: /영업비밀|이직|기술유출|경업|비밀유지|전직/i,
    domain: "부정경쟁/영업비밀",
    defaultLaws: ["부정경쟁방지 및 영업비밀보호에 관한 법률", "형법"],
  },
  {
    pattern: /사기|횡령|배임|고소|협박|명예훼손|모욕/i,
    domain: "형사/범죄",
    defaultLaws: ["형법"],
  },
]

export async function evaluateRisk(
  apiClient: LawApiClient,
  input: RiskEvaluatorInput
): Promise<LooseToolResponse> {
  const { situation, domain: userDomain, apiKey } = input

  if (!situation || situation.trim().length === 0) {
    return {
      content: [{ type: "text", text: "상황 설명(situation)이 입력되지 않았습니다." }],
      isError: true,
    }
  }

  // 1. 도메인 및 타겟 법령 감지
  let detectedDomain = userDomain || "일반 법률"
  let targetLaws: string[] = []

  for (const item of DOMAIN_PATTERNS) {
    if (item.pattern.test(situation)) {
      if (!userDomain) detectedDomain = item.domain
      targetLaws.push(...item.defaultLaws)
    }
  }

  if (targetLaws.length === 0) {
    targetLaws = ["민법", "형법"]
  }
  // 중복 제거
  targetLaws = Array.from(new Set(targetLaws))

  // 2. 검색 및 조문 수집
  const lawResults: Array<{ lawName: string; joContent?: string; mst?: string }> = []
  const riskFactors: RiskFactor[] = []

  for (const lawName of targetLaws.slice(0, 3)) {
    try {
      const searchRes = await searchLaw(apiClient, { query: lawName, display: 10, apiKey })
      const textContent = searchRes.content?.[0]?.text || ""
      const mstMatch = textContent.match(/mst[:=]\s*(\d+)/i) || textContent.match(/ID[:=]\s*(\d+)/i)

      if (mstMatch && mstMatch[1]) {
        const mst = mstMatch[1]
        const lawTextRes = await getLawText(apiClient, { mst, apiKey })
        const rawBody = lawTextRes.content?.[0]?.text || ""

        lawResults.push({
          lawName,
          mst,
          joContent: rawBody.slice(0, 800), // 주요 조문 일부 백업
        })

        // 벌칙 조항 키워드 정밀 탐색
        if (/벌칙|과태료|손해배상|해지|취소|무효|처벌/i.test(rawBody)) {
          const penaltyMatch = rawBody.match(/제\d+조\s*\([^)]*벌칙[^)]*\)[^제]*/gi) ||
                               rawBody.match(/제\d+조\s*\([^)]*과태료[^)]*\)[^제]*/gi) ||
                               rawBody.match(/제\d+조[^.\n]*벌금|몰수|징역|과태료/gi)

          if (penaltyMatch && penaltyMatch.length > 0) {
            riskFactors.push({
              category: "벌칙/과태료 규정",
              lawName,
              articleNo: penaltyMatch[0].slice(0, 50).trim(),
              description: `${lawName} 상 벌칙 또는 과태료 처분 조항 검토 필요`,
              severity: "HIGH",
            })
          }
        }
      }
    } catch {
      // 단일 법령 검색 실패 시 다음 법령 계속 탐색
    }
  }

  // 3. 판례 힌트 수집
  let precedentSummary = ""
  try {
    const precedentRes = await searchDecisions(apiClient, {
      domain: "precedent",
      query: situation.slice(0, 30),
      display: 2,
    })
    const precText = precedentRes.content?.[0]?.text || ""
    if (precText && !precText.includes("0건")) {
      precedentSummary = precText.slice(0, 500)
    }
  } catch {
    // 판례 조회 실패 시 건너뜀
  }

  // 4. 상황 기반 룰 분석 & severity 산출
  if (riskFactors.length === 0) {
    if (/고소|고발|경찰|검찰|이직|유출|해고|계약해지/i.test(situation)) {
      riskFactors.push({
        category: "분쟁/소송 리스크",
        lawName: targetLaws[0] || "관련 법률",
        description: "상대방에 의한 민·형사상 고소 또는 법적 조치 가능성 존재",
        severity: "HIGH",
      })
    } else {
      riskFactors.push({
        category: "권리 의무 관계",
        lawName: targetLaws[0] || "관련 법률",
        description: "법률상 요건 충족 여부에 따른 손해배상 또는 의무 불이행 위험",
        severity: "MEDIUM",
      })
    }
  }

  // 5. 마크다운 보고서 구성
  const overallSeverity = riskFactors.some(r => r.severity === "HIGH") ? "🔴 HIGH (위험 소지 큼)" : "🟡 MEDIUM (주의 필요)"

  let markdown = `# ⚖️ 법률 리스크 진단 보고서 (Risk Assessment Report)\n\n`
  markdown += `### 📌 진단 입력 상황\n> ${situation}\n\n`
  markdown += `--- \n`
  markdown += `### 🔍 1. 주요 감지 도메인 및 적용 법령\n`
  markdown += `- **분석 도메인**: ${detectedDomain}\n`
  markdown += `- **검토 법령**: ${targetLaws.map(l => `\`${l}\``).join(", ")}\n\n`

  markdown += `### ⚠️ 2. 종합 리스크 평가: ${overallSeverity}\n\n`
  markdown += `| 카테고리 | 관련 법령 | 세부 조문 / 내용 | 리스크 수준 |\n`
  markdown += `|---|---|---|---|\n`
  for (const factor of riskFactors) {
    markdown += `| ${factor.category} | ${factor.lawName} | ${factor.articleNo || factor.description} | ${factor.severity === "HIGH" ? "🔴 HIGH" : "🟡 MEDIUM"} |\n`
  }
  markdown += `\n`

  if (precedentSummary) {
    markdown += `### 📜 3. 참조 대법원 판례 힌트\n`
    markdown += `\`\`\`text\n${precedentSummary.trim()}\n\`\`\`\n\n`
  }

  markdown += `### 💡 4. 권장 대응 가이드라인 (5-Step Action Plan)\n`
  markdown += `1. **사실관계 증거 확보**: 관련 계약서, 대화 내역(카카오톡/메일), 내용증명 등 입증 자료 수집\n`
  markdown += `2. **적용 조문 정밀 확인**: 개정 시점에 따른 행위시법 적용 여부 확인 (\`legal_analysis mode=applicable_law\` 활용)\n`
  markdown += `3. **상대방 서면 통지**: 최고서 또는 내용증명을 통해 법적 의사 표시 진행\n`
  markdown += `4. **분쟁조정위원회 활용**: (임대차/노동/개인정보 등) 관련 분쟁조정제도 신청 검토\n`
  markdown += `5. **전문가 자문**: 구체적인 소송 대응 시 정식 법률 전문가(변호사/노무사)와 상담\n\n`

  markdown += `> [!IMPORTANT]\n`
  markdown += `> **법적 고지 (Disclaimer)**\n`
  markdown += `> 본 보고서는 법제처 Open API 데이터를 기반으로 한 자동화 1차 분석 참고 자료입니다. 실시간 개정 사항이나 구체적 특수 정황에 따라 법적 판단이 달라질 수 있으므로, 최종 법적 조치는 변호사 등 법률 전문가와 상담하시기 바랍니다.\n`

  const finalOutput = truncateResponse(markdown)
  return {
    content: [{ type: "text", text: finalOutput }],
    isError: false,
  }
}
