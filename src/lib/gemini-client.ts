/**
 * Gemini 파운데이션 모델 REST API 연동 클라이언트 (Minimalist & Raw Fetch)
 */

export interface GeminiAnalysisOptions {
  situation: string
  lawContext: string
  apiKey: string
  domain?: string
}

export async function generateGeminiLegalAnalysis(options: GeminiAnalysisOptions): Promise<string> {
  const { situation, lawContext, apiKey, domain } = options

  if (!apiKey) {
    throw new Error("Gemini API 키가 제공되지 않았습니다.")
  }

  const prompt = `
[역할 정의]
당신은 대한민국 법률에 정통한 수석 법률 자문 AI 전문위원입니다.
제공된 [대한민국 법제처 실정법 조문 및 대법원 판례 DB 수집 데이터]를 바탕으로, 사용자의 [구체적 문제 상황]을 정밀 분석하고 위법 소지, 리스크 평가 및 단계별 대응 전략을 작성하세요.

[분석 지침]
1. 반드시 제공된 법제처 조문 및 판례 데이터에 근거하여 답변을 구성하세요.
2. 가독성이 뛰어난 Markdown 리포트 형식으로 작성하세요.
3. 다음 목차 구조를 포함하세요:
   - 📌 1. 핵심 요약 및 상황 판단
   - ⚖️ 2. 관련 법령 조문 및 판례 대조 분석
   - 🚨 3. 위법 소지 및 법적 리스크 진단 (과태료/벌칙/민형사책임)
   - 💡 4. 실무 대응 및 리스크 완화 가이드 (단계별 Action Plan)

[구체적 문제 상황]
${situation}
${domain ? `[지정 법률 도메인]: ${domain}` : ""}

[대한민국 법제처 실정법 조문 및 판례 DB 수집 데이터]
${lawContext}
`

  // Gemini 표준 모델 순차 시도 (2.0-flash ➔ 1.5-flash ➔ 1.5-pro)
  const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
  let lastError: Error | null = null

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2500,
          }
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Gemini API 호출 실패 (${model}): ${errText}`)
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>
          }
        }>
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        return text
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError || new Error("Gemini API 호출 중 오류가 발생했습니다.")
}
