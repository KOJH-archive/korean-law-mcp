/**
 * Korean Law MCP Web Dashboard Client Logic (Pure JavaScript)
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Mermaid.js if present
  if (window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: "default" });
  }

  // API Key LocalStorage & Status Badge Handling
  const apiKeyInput = document.getElementById("apiKey");
  const apiKeyBadge = document.getElementById("apiKeyBadge");
  const toggleApiKeyBtn = document.getElementById("toggleApiKeyVisible");

  function updateApiKeyStatus() {
    const val = apiKeyInput ? apiKeyInput.value.trim() : "";
    if (apiKeyBadge) {
      if (val.length > 0) {
        apiKeyBadge.className = "badge badge-active";
        apiKeyBadge.textContent = "🟢 커스텀 API 키 적용됨";
      } else {
        apiKeyBadge.className = "badge badge-inactive";
        apiKeyBadge.textContent = "🟡 서버 기본 API 키 (LAW_OC) 사용 중";
      }
    }
  }

  if (apiKeyInput) {
    const savedKey = localStorage.getItem("LAW_OC") || "";
    apiKeyInput.value = savedKey;
    updateApiKeyStatus();

    apiKeyInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      localStorage.setItem("LAW_OC", val);
      updateApiKeyStatus();
    });
  }

  if (toggleApiKeyBtn && apiKeyInput) {
    toggleApiKeyBtn.addEventListener("click", () => {
      if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
        toggleApiKeyBtn.textContent = "🙈";
      } else {
        apiKeyInput.type = "password";
        toggleApiKeyBtn.textContent = "👁️";
      }
    });
  }

  function getApiKey() {
    return apiKeyInput ? apiKeyInput.value.trim() : "";
  }

  // 2. Tab Navigation
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });

  // 3. Quick Scenario Chips
  const chips = document.querySelectorAll(".chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const queryText = chip.getAttribute("data-query");
      if (!queryText) return;

      const situationInput = document.getElementById("situationInput");
      const queryInput = document.getElementById("queryInput");

      // Set value based on text pattern or active tab
      if (queryText.includes("리스크") || queryText.includes("유출") || queryText.includes("처벌")) {
        document.querySelector('[data-tab="risk-tab"]').click();
        if (situationInput) situationInput.value = queryText;
      } else {
        document.querySelector('[data-tab="search-tab"]').click();
        if (queryInput) queryInput.value = queryText;
      }
    });
  });

  // Helper function to render Markdown to HTML safely
  function renderMarkdown(mdText) {
    if (window.marked && typeof window.marked.parse === "function") {
      return window.marked.parse(mdText);
    }
    return mdText
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  // Render Mermaid diagrams in rendered container if found
  function renderMermaidInContainer(container) {
    if (!window.mermaid) return;
    const codeBlocks = container.querySelectorAll("code.language-mermaid, pre code");
    codeBlocks.forEach((codeEl, index) => {
      const text = codeEl.textContent || "";
      if (text.includes("graph") || text.includes("flowchart") || text.includes("sequenceDiagram")) {
        const parent = codeEl.parentElement;
        const mermaidDiv = document.createElement("div");
        mermaidDiv.className = "mermaid-box";
        mermaidDiv.id = `mermaid-${Date.now()}-${index}`;
        mermaidDiv.textContent = text;
        if (parent && parent.tagName.toLowerCase() === "pre") {
          parent.replaceWith(mermaidDiv);
        } else {
          codeEl.replaceWith(mermaidDiv);
        }
        try {
          window.mermaid.run({ nodes: [mermaidDiv] });
        } catch (err) {
          console.warn("Mermaid render error:", err);
        }
      }
    });
  }

  // 4. Handle Risk Diagnosis Execution
  const btnRiskEval = document.getElementById("btnRiskEval");
  const situationInput = document.getElementById("situationInput");
  const domainSelect = document.getElementById("domainSelect");
  const riskResultArea = document.getElementById("riskResultArea");
  const riskSpinner = document.getElementById("riskSpinner");
  const riskReportCard = document.getElementById("riskReportCard");

  if (btnRiskEval) {
    btnRiskEval.addEventListener("click", async () => {
      const situation = situationInput ? situationInput.value.trim() : "";
      if (!situation) {
        alert("진단할 구체적인 상황(Fact)을 입력해 주세요.");
        if (situationInput) situationInput.focus();
        return;
      }

      const domain = domainSelect ? domainSelect.value : "";
      const apiKey = getApiKey();

      // UI Loading state
      riskResultArea.classList.remove("hidden");
      riskSpinner.classList.remove("hidden");
      riskReportCard.classList.add("hidden");
      riskReportCard.innerHTML = "";

      try {
        const response = await fetch("/api/risk-eval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ situation, domain, apiKey }),
        });

        const data = await response.json();

        riskSpinner.classList.add("hidden");
        riskReportCard.classList.remove("hidden");

        if (data.isError) {
          riskReportCard.innerHTML = `<div style="color:#f43f5e; font-weight:600;">❌ 진단 중 오류가 발생했습니다: ${data.message || "알 수 없는 에러"}</div>`;
        } else {
          riskReportCard.innerHTML = renderMarkdown(data.markdown || "");
          renderMermaidInContainer(riskReportCard);
        }
      } catch (error) {
        riskSpinner.classList.add("hidden");
        riskReportCard.classList.remove("hidden");
        riskReportCard.innerHTML = `<div style="color:#f43f5e; font-weight:600;">❌ 서버와 통신할 수 없습니다: ${error.message}</div>`;
      }
    });
  }

  // 5. Handle Search Execution
  const btnSearch = document.getElementById("btnSearch");
  const queryInput = document.getElementById("queryInput");
  const searchResultArea = document.getElementById("searchResultArea");
  const searchSpinner = document.getElementById("searchSpinner");
  const searchReportCard = document.getElementById("searchReportCard");

  async function executeSearch() {
    const query = queryInput ? queryInput.value.trim() : "";
    if (!query) {
      alert("검색할 법령명, 판례 키워드 또는 질의를 입력해 주세요.");
      if (queryInput) queryInput.focus();
      return;
    }

    const apiKey = getApiKey();

    searchResultArea.classList.remove("hidden");
    searchSpinner.classList.remove("hidden");
    searchReportCard.classList.add("hidden");
    searchReportCard.innerHTML = "";

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, apiKey }),
      });

      const data = await response.json();

      searchSpinner.classList.add("hidden");
      searchReportCard.classList.remove("hidden");

      if (data.isError) {
        searchReportCard.innerHTML = `<div style="color:#f43f5e; font-weight:600;">❌ 검색 중 오류가 발생했습니다: ${data.message || "알 수 없는 에러"}</div>`;
      } else {
        let routeHtml = "";
        if (data.route) {
          routeHtml = `<div style="margin-bottom: 12px; font-size: 13px; color: #38bdf8;">🎯 자동 추천 도구: <strong>${data.route.tool}</strong> (${data.route.reason})</div>`;
        }
        searchReportCard.innerHTML = routeHtml + renderMarkdown(data.text || "");
        renderMermaidInContainer(searchReportCard);
      }
    } catch (error) {
      searchSpinner.classList.add("hidden");
      searchReportCard.classList.remove("hidden");
      searchReportCard.innerHTML = `<div style="color:#f43f5e; font-weight:600;">❌ 서버와 통신할 수 없습니다: ${error.message}</div>`;
    }
  }

  if (btnSearch) {
    btnSearch.addEventListener("click", executeSearch);
  }

  if (queryInput) {
    queryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        executeSearch();
      }
    });
  }
});
