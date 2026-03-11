## F5 实现计划：浏览器增强（Web Search & Browse）

### Summary
- 新增两个可被 Agent 调用的工具：`web_search`（实时搜索）与 `browse_page`（网页抓取+正文抽取+Markdown 化+截断/摘要）。
- 所有 Web 请求在执行前必须经过安全校验：URL/Query 规则（SSRF、防内网、敏感词/黑名单），并支持可选安全代理转发。

### Key Changes
1) **新增工具：`web_search`**
- **接口（Tool）**
  - `query: string`（必填）
  - `numResults?: number`（默认 5，上限 10）
  - `recencyDays?: number`（默认 7；用于“今天/最新”场景）
  - `site?: string`（可选，如 `github.com`）
  - `language?: string`（默认 `zh-CN`）
- **返回结构**
  - `{ query, results: [{ title, url, snippet, source?, publishedAt? }], fetchedAt }`
- **实现**
  - 设计 `SearchProvider` 抽象（`search(query, opts)`），用环境变量选择：
    - `WEB_SEARCH_PROVIDER=tavily|serpapi`（默认 `tavily`）
    - 依赖对应 API Key（缺失则工具返回可读错误，提示配置项）
  - 对结果做“长度控制”：限制 `snippet` 长度、限制总字符数，避免挤爆 `MemoryManager`。

2) **新增工具：`browse_page`**
- **接口（Tool）**
  - `url: string`（必填，仅允许 `http/https`）
  - `maxChars?: number`（默认 12000，用于最终 Markdown 截断）
  - `format?: 'markdown'|'text'`（默认 `markdown`）
- **处理流水线**
  - `fetch(url)` 获取 HTML/Markdown
  - 若为 HTML：用 Readability 风格正文抽取（建议 `@mozilla/readability` + `jsdom` 或等价轻量 DOM）
  - 将正文转换为 Markdown（建议 `turndown`），保留标题/小标题/列表/代码块/链接
  - **自动去噪**：移除导航/页脚/广告区块（Readability + 规则兜底）
  - **摘要/截断**：输出 `summary`（启发式：标题+首段+要点）+ `content`（`maxChars` 截断）
- **返回结构**
  - `{ url, title?, summary, content, contentType, fetchedAt }`

3) **安全与合规：扩展 `SecurityLayer` + 在 `AgentController` 强制执行**
- 在 `SecurityLayer` 增加：
  - `checkUrl(url): SecurityCheckResult`：拒绝 `file://`、`localhost`、私网 IP 段（`127.0.0.0/8`、`10/8`、`172.16/12`、`192.168/16`、`::1`、`fc00::/7` 等）、过长 URL、可疑端口（默认拒绝非 80/443，或要求 HITL）。
  - `checkWebText(text): SecurityCheckResult`：对 query/URL 进行敏感词与高风险模式检测（可复用现有 `sensitivePatterns` 思路，新增 web 维度规则）。
- 在 `AgentController` 对 `web_search`/`browse_page`：
  - 先 `checkWebText(query)` / `checkUrl(url)`；`blocked` 直接拒绝；`sensitive` 走 HITL `requestApproval(...)`。

4) **安全代理（可选但推荐）**
- 新增环境变量：
  - `WEB_PROXY_URL`（如公司安全代理）
  - `WEB_USER_AGENT`（固定 UA，便于可控抓取）
- Web 工具的 HTTP 客户端优先走代理；即使走代理也仍执行 `SecurityLayer` 校验（双保险）。

5) **接入与配置**
- 在启动处注册新工具（与现有 `ReadFileTool` 等同级）。
- 更新 `.env.example` 增加：
  - `WEB_SEARCH_PROVIDER`、`TAVILY_API_KEY`、`SERPAPI_API_KEY`、`WEB_PROXY_URL`、`WEB_USER_AGENT`

### Test Plan
- **Unit**
  - `SecurityLayer.checkUrl`：覆盖 `https://example.com` 允许、`http://127.0.0.1`/`http://192.168.0.1` 拒绝、超长 URL 拒绝、非 443 端口需审批（或拒绝，按实现策略）。
  - `checkWebText`：含敏感词的 query 触发 `needsApproval`。
- **Integration（不联网）**
  - 为 `web_search`/`browse_page` 支持注入 `fetch`（或 HTTP client）mock：
    - `web_search` mock 返回固定 JSON，断言输出结构与截断策略生效。
    - `browse_page` mock 返回示例 HTML，断言能抽取正文并生成 Markdown、summary 不为空。
- **E2E（可选，需真实 key/网络）**
  - 用“今天发布的最新版框架特性”类问题验证：先 `web_search(recencyDays=1)`，再 `browse_page` 读取权威来源页面并回答。

### Assumptions / Defaults
- 默认搜索提供方：`tavily`；未配置 key 时返回“需要配置 API Key”的明确错误（不做无 key 的网页爬虫搜索，避免不稳定与合规风险）。
- `browse_page` 默认输出 Markdown，并强制 `maxChars` 截断 + 简要 `summary`，以满足“防上下文溢出”验收点。
- Web 请求默认拒绝内网/本机目标（SSRF 防护）；如确需放开，通过新增 allowlist 环境变量再讨论扩展。
