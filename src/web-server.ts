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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const publicPath = path.resolve(__dirname, "../public")

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

// 2. 상황 기반 법률 리스크 진단 API
app.post("/api/risk-eval", async (req, res) => {
  const { situation, domain, apiKey } = req.body
  if (!situation || typeof situation !== "string") {
    res.status(400).json({ isError: true, message: "situation 파라미터가 입력되지 않았습니다." })
    return
  }

  try {
    const apiClient = getClient(apiKey)
    const result = await legalAnalysis(apiClient, {
      mode: "risk_eval",
      situation,
      domain,
      apiKey: apiKey || undefined,
    })

    const markdown = result.content.map(c => c.text).join("\n")
    res.json({
      situation,
      markdown,
      isError: result.isError || false,
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
