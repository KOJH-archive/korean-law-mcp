import { describe, it, expect, vi, beforeEach } from "vitest"
import { generateGeminiLegalAnalysis } from "./gemini-client.js"

describe("generateGeminiLegalAnalysis", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("API 키가 없으면 에러를 던져야 함", async () => {
    await expect(
      generateGeminiLegalAnalysis({
        situation: "음주운전",
        lawContext: "도로교통법 제44조",
        apiKey: "",
      })
    ).rejects.toThrow("Gemini API 키가 제공되지 않았습니다.")
  })

  it("정상적인 API 응답 시 텍스트 결과를 반환해야 함", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "Gemini 분석 결과: 위법 소지 있음" }],
          },
        },
      ],
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })
    )

    const result = await generateGeminiLegalAnalysis({
      situation: "음주운전 적발",
      lawContext: "도로교통법 제44조",
      apiKey: "test-key",
    })

    expect(result).toBe("Gemini 분석 결과: 위법 소지 있음")
  })

  it("첫 번째 모델 실패 시 다음 모델로 fallback하여 성공해야 함", async () => {
    const fetchMock = vi.fn()
    // 첫번째 모델 호출(gemini-2.5-flash)은 404 실패
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => '{"error": {"code": 404, "message": "models/gemini-2.5-flash is not found"}}',
    })
    // 두번째 모델 호출(gemini-2.0-flash)은 성공
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "2.0-flash 성공 결과" }] } }],
      }),
    })

    vi.stubGlobal("fetch", fetchMock)

    const result = await generateGeminiLegalAnalysis({
      situation: "음주운전 적발",
      lawContext: "도로교통법 제44조",
      apiKey: "test-key",
    })

    expect(result).toBe("2.0-flash 성공 결과")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
