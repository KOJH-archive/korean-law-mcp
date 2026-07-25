import { describe, it, expect } from "vitest"
import { evaluateRisk } from "./risk-evaluator.js"
import { legalAnalysis } from "./legal-analysis.js"
import type { LawApiClient } from "../lib/api-client.js"

describe("risk-evaluator", () => {
  const mockApiClient = {
    fetchXml: async () => ({}),
    fetchJson: async () => ({}),
  } as unknown as LawApiClient

  it("상황 미입력 시 에러 반환", async () => {
    const res = await evaluateRisk(mockApiClient, { situation: "" })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain("상황 설명")
  })

  it("임대차 상황 입력 시 관련 도메인 감지 및 리포트 반환", async () => {
    const situation = "전세 계약 기간이 끝났는데 집주인이 보증금을 안 줘요."
    const res = await evaluateRisk(mockApiClient, { situation })
    expect(res.isError).toBe(false)
    const text = res.content[0].text
    expect(text).toContain("임대차")
    expect(text).toContain("주택임대차보호법")
    expect(text).toContain("법률 리스크 진단 보고서")
    expect(text).toContain("Disclaimer")
  })

  it("legalAnalysis 통합 도구에서 mode=risk_eval 실행", async () => {
    const situation = "직원이 이직하면서 영업비밀 서류를 가져갔습니다."
    const res = await legalAnalysis(mockApiClient, {
      mode: "risk_eval",
      situation,
    })
    expect(res.isError).toBe(false)
    const text = res.content[0].text
    expect(text).toContain("부정경쟁/영업비밀")
    expect(text).toContain("부정경쟁방지 및 영업비밀보호에 관한 법률")
  })
})
