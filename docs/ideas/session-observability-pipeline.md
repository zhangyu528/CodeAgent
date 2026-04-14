# Session 可观测性管道

## Problem Statement

CodeAgent 的会话数据在运行时产生，但缺乏结构化的可观测性基础设施。当前状态：

1. **错误分散** — 工具执行失败、API 超时、模型拒绝等事件没有统一的错误分类和聚合机制，分散在 session JSON 文件的 message 对象中，难以追踪趋势
2. **指标缺失** — 没有会话级别的指标（工具调用频率、token 消耗分布、会话生命周期时长、每轮对话成本），既无法做产品决策，也无法做成本控制
3. **日志碎片化** — `console.log` 散布在 agent 和 tools 代码中，没有结构化日志输出，调试依赖临时加日志
4. **可追溯性弱** — 一个会话中途失败后，用户无法快速定位是哪一步出了问题；`structured-error-recovery-modal` 只能展示单次错误，无法呈现历史模式

结果：随着用户会话增多，团队对 CodeAgent 在生产环境中的行为几乎是盲区。

---

## Recommended Direction

**构建 Session 可观测性管道**：在 agent 核心层和工具层植入结构化事件发射机制，以会话为作用域，聚合到 SQLite 中，支持查询接口和未来导出到分析系统。

### 核心架构

```
src/agent/observability/
├── pipeline.ts          # 事件总线，单例，负责收集 + 过滤 + 路由
├── events.ts            # 事件类型定义（ToolEvent, LLMEvent, SessionEvent）
├── store.ts             # SQLite 聚合存储（会话级别指标）
├── query.ts             # 查询接口（供 CLI 调试命令和未来 dashboard 使用）
└── reporters/
    ├── session-reporter.ts   # 会话结束时生成摘要
    └── error-reporter.ts     # 错误聚合报告
```

### 事件类型

```typescript
// 工具事件
interface ToolEvent {
  type: 'tool_call' | 'tool_success' | 'tool_error';
  sessionId: string;
  turnId: string;
  tool: string;           // 'read_file' | 'run_command' | ...
  durationMs: number;
  errorCode?: string;     // 'PERMISSION_DENIED' | 'TIMEOUT' | ...
  metadata?: Record<string, unknown>;
}

// LLM 事件
interface LLMEvent {
  type: 'llm_request' | 'llm_response' | 'llm_error';
  sessionId: string;
  turnId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  cost?: number;          // 估算成本
  errorCode?: string;
}

// 会话事件
interface SessionEvent {
  type: 'session_start' | 'session_end' | 'session_resume';
  sessionId: string;
  timestamp: number;
  messageCount: number;
  durationMs: number;
  exitReason?: string;
}
```

### SQLite 存储设计

```sql
-- 会话指标表（每会话一行，高频写入，查询友好）
CREATE TABLE session_metrics (
  session_id TEXT PRIMARY KEY,
  started_at INTEGER,
  ended_at INTEGER,
  message_count INTEGER,
  total_tool_calls INTEGER,
  total_llm_calls INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error_code TEXT
);

-- 事件表（append-only，事件驱动记录）
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  event_type TEXT,
  turn_id TEXT,
  tool TEXT,
  duration_ms INTEGER,
  error_code TEXT,
  metadata TEXT,           -- JSON
  created_at INTEGER
);
```

### 与 N5 的关系

`session-observability-pipeline` 是 N5（会话治理与搜索增强）的前置依赖：
- N5 的 TTL、归档、导出功能需要知道会话的使用频率和最后活跃时间（`session_metrics` 提供）
- N5 的错误趋势分析需要 `events` 表的历史数据
- N5 的搜索增强可以基于 `events` 表构建工具调用频率索引

---

## Key Assumptions to Validate

- [ ] **假设 1**：SQLite 路径与现有 session 存储路径一致（`~/.codeagent/`），无需额外配置
  *验证方法*：检查 `src/agent/constants.ts` 中的路径常量
- [ ] **假设 2**：事件发射不阻塞主 agent 循环（异步写入，不在关键路径上）
  *验证方法*：在 pipeline 中使用 `queueMicrotask` 或 `setImmediate` 异步写入
- [ ] **假设 3**：用户愿意接受 SQLite 依赖（无额外安装成本，`node:sqlite` 自 Node 22 内置）
  *验证方法*：检查 `package.json` engines 字段，确认 Node 版本要求 >= 22

---

## MVP Scope

**纳入范围：**
1. `src/agent/observability/` 目录及核心文件（pipeline, events, store）
2. 工具层事件拦截（`run_command.ts`、`read_file.ts`、`write_file.ts` 在执行后发射事件）
3. LLM 调用事件拦截（在 `agent.ts` 的模型调用处植入）
4. SQLite 存储初始化（若 DB 不存在则创建）
5. 会话结束时自动写入 `session_metrics` 摘要行
6. 查询接口：`getSessionMetrics(sessionId)` 和 `getRecentErrors(limit)`
7. CLI 调试命令：`/debug metrics` — 显示当前会话的实时指标

**不纳入范围：**
- 结构化日志输出到文件（后续可扩展 `reporter`）
- Dashboard / Web UI（N5 治理功能的一部分）
- 成本告警（需要先有指标基础）
- 跨会话聚合分析（N5 工作的一部分）
- 事件重放 / 调试模式（未来可探索）

---

## Not Doing (and Why)

- **结构化日志文件输出**：增加 I/O 负担，且已有 session JSON 可以部分替代；先聚焦指标聚合
- **Dashboard UI**：过早；CLI 用户习惯命令行，`/debug metrics` 足够在 MVP 阶段满足可观测需求
- **主动告警**：需要定义告警规则和通知渠道，超出 MVP 范围；由 N5 的治理规则引擎接管
- **事件重放**：复杂度高，需要定义事件 schema 版本化；MVP 只写入，不设计回放机制
- **指标可视化**：图表类需求属于 N5 dashboard 范畴，MVP 只提供原始数据查询

---

## Open Questions

1. 事件存储的保留策略是什么 — 是否需要 TTL 自动清理（`events` 表可能增长很快）？
2. `estimated_cost` 的计算模型 — 按 provider 定价表还是简单 token 计数？
3. 是否需要支持关闭可观测性（某些用户对性能敏感，不希望任何异步写入）？
4. 事件 `metadata` 的 schema 是否需要版本化（防止 schema 演进后旧事件无法解析）？
5. `turn_id` 如何生成 — 基于消息索引还是 UUID？
