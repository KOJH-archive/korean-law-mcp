/**
 * Express 기반 Web Dashboard 백엔드 서버 (v4.8.0)
 */

import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import { LawApiClient } from "./lib/api-client.js"
import { routeQuery } from "./lib/query-router.js"
import { executeTool } from "./lib/cli-executor.js"
import { legalAnalysis } from "./tools/legal-analysis.js"

import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function findPublicPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "public"),
    path.resolve(path.dirname(process.execPath), "public"),
    path.resolve(__dirname, "../public"),
    path.resolve(__dirname, "./public"),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) {
      return dir
    }
  }
  return path.resolve(process.cwd(), "public")
}

const app = express()
const PORT = process.env.PORT || 3000
const publicPath = findPublicPath()

app.use(express.json({ limit: "1mb" }))
app.use(express.static(publicPath))

function getClient(userApiKey?: string): LawApiClient {
  const apiKey = userApiKey || process.env.LAW_OC || ""
  return new LawApiClient({ apiKey })
}

// 1. 자연어 종합 리서치 API
app.post("/api/query", async (req, res) => {
  const { query, apiKey } = req.body
  if (!query || typeof query !== "string") {
    res.status(400).json({ isError: true, message: "query 파라미터가 유효하지 않습니다." })
    return
  }

  try {
    const apiClient = getClient(apiKey)
    const route = routeQuery(query)

    if (route.dateRange) {
      route.params.fromDate = route.dateRange.from
      route.params.toDate = route.dateRange.to
    }

    const result = await executeTool(apiClient, route.tool, {
      ...route.params,
      apiKey: apiKey || undefined
    })

    const text = result.content.map(c => c.text).join("\n")
    res.json({
      query,
      route: { tool: route.tool, reason: route.reason },
      text,
      isError: result.isError || false,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ isError: true, message: msg })
  }
})

import { generateGeminiLegalAnalysis } from "./lib/gemini-client.js"

// 2. 상황 기반 법률 리스크 진단 API
app.post("/api/risk-eval", async (req, res) => {
  const { situation, domain, apiKey, geminiApiKey } = req.body
  if (!situation || typeof situation !== "string") {
    res.status(400).json({ isError: true, message: "situation 파라미터가 입력되지 않았습니다." })
    return
  }

  try {
    const apiClient = getClient(apiKey)
    const baseResult = await legalAnalysis(apiClient, {
      mode: "risk_eval",
      situation,
      domain,
      apiKey: apiKey || undefined,
    })

    const rawContextMarkdown = baseResult.content.map(c => c.text).join("\n")
    const effectiveGeminiKey = geminiApiKey || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || ""

    let finalMarkdown = rawContextMarkdown

    if (effectiveGeminiKey) {
      try {
        const aiAnalysis = await generateGeminiLegalAnalysis({
          situation,
          lawContext: rawContextMarkdown,
          apiKey: effectiveGeminiKey,
          domain: domain || undefined,
        })

        finalMarkdown = `${aiAnalysis}\n\n---\n### 🏛️ 법제처 실정법 및 대법원 판례 DB 원문 근거\n\n${rawContextMarkdown}`
      } catch (geminiError) {
        console.warn("[Gemini API Warning]:", geminiError)
        const errMsg = geminiError instanceof Error ? geminiError.message : String(geminiError)
        finalMarkdown = `> ⚠️ **Gemini AI 심층 분석 연동 알림**: ${errMsg}\n> (법제처 실정법 진단 결과를 직접 표시합니다.)\n\n${rawContextMarkdown}`
      }
    }

    res.json({
      situation,
      markdown: finalMarkdown,
      isError: baseResult.isError || false,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ isError: true, message: msg })
  }
})

// SPA Fallback: Express 5.x compatible fallback middleware
app.use((req, res) => {
  res.sendFile(path.join(publicPath, "index.html"))
})

app.listen(PORT, () => {
  console.log(`\n===================================================`)
  console.log(`  ⚖️ Korean Law Web Dashboard Server Running!`)
  console.log(`  - URL: http://localhost:${PORT}`)
  console.log(`===================================================\n`)
})
