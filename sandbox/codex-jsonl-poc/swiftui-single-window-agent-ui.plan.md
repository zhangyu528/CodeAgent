---
name: swiftui-single-window-agent-ui
overview: 为 macOS 单窗口 SwiftUI 客户端规划一套 MVP UI，用于可视化展示 Agent 的核心能力：Chat 流式输出、上下文管理、执行时间线、权限确认、Diff 预览（基于 git diff）、Provider 状态与 Web 证据链。
todos:
  - id: ui-skeleton
    content: 搭建单窗口三栏布局 + toolbar（Chat/Context/Inspector tabs）
    status: pending
  - id: exec-mode
    content: 增加执行模式开关（Plan-first vs Auto-run）与“批准并执行”交互
    status: pending
  - id: agent-events
    content: 定义最小通知事件（ui/log、ui/step、ui/approval.request）并在 SwiftUI 时间线展示
    status: pending
  - id: approval-ui
    content: 实现授权弹层与回传（允许/拒绝）
    status: pending
  - id: diff-tab
    content: 实现 Diff tab：运行并解析 `git diff`，按文件展示
    status: pending
  - id: provider-web
    content: 增加 Provider 状态条与 Web 证据 tab（来源列表）
    status: pending
---

# macOS SwiftUI 单窗口 Agent UI 规划

## 目标

用一个单窗口 SwiftUI 客户端，把你当前 Agent 已具备的能力（见 `docs/ROADMAP.md`：F1/F3/F4/F5/F6/P1 等）以“可见、可控、可证明”的方式呈现出来，便于 demo 与日常使用。

## MVP 必备能力映射（UI 必须能看见）

- **对话与流式输出**：展示最终回答 + 中间过程的持续输出。
- **上下文管理（F3/F1）**：展示自动上下文 + 用户附加上下文，且可增删。
- **执行轨迹时间线（P0/P1 事件总线）**：thought/plan → tool call → observation（stdout/stderr/文件/网页）。
- **安全确认（F6 + 工具安全层）**：写文件/跑命令/访问 Web 前显式确认，拒绝时给原因。
- **Diff 预览与应用（P1 执行闭环）**：展示变更并可分段应用（先按文件级）。Diff 来源用 `git diff` 文本。
- **Provider/模型状态（F4）**：当前 provider/model + token/cost（如已有 telemetry）展示与切换。
- **Web 证据链（F5）**：当用 web_search/browse_page，列出来源与摘要。

## 单窗口信息架构（推荐布局）

- **顶部 Toolbar**
  - Provider 下拉（openai/deepseek/ollama…）+ 模型名
  - 执行模式（Execution Mode）：
    - `Plan-first`：先只生成计划，不执行工具；用户点“批准并执行”后才进入执行
    - `Auto-run`：直接执行（仍受授权弹窗约束：写文件/跑命令/访问 Web）
  - Token/Cost 迷你统计（可选开关）
  - 连接状态（Agent 运行/已断开/需要授权）
- **左侧 Sidebar：上下文 + 会话**
  - **会话列表**（MVP 可只做“当前会话 + 新建/清空”）
  - **上下文列表**
    - Auto context（只读）：OS/cwd/README 摘要/项目树摘要
    - Attached context（可移除）：文件、选区、目录、搜索结果片段
  - 「添加上下文」入口：选择文件/目录；后续再接 IDE 选区。
- **中间 Main：Chat 视图**
  - 用户消息 + Agent 回复
  - 回复支持：Markdown、代码块、复制
  - 流式输出：逐段追加（UI 显示“正在生成”）
- **右侧 Inspector：执行轨迹 / 工具 / Diff / Web**
  - Tab 形式（MVP）：
    - **Timeline**：步骤卡片（Plan/Tool/Observation），可折叠
    - **Diff**：按文件列出 `git diff`，点击文件展开 diff
    - **Web**：搜索结果列表 + 已浏览页面摘要/截断提示
  - 当有安全确认时，Inspector 顶部浮层显示 Approval 卡片。

## 关键数据模型与事件流

- **核心状态（ViewModel）**
  - `messages: [ChatMessage]`
  - `timeline: [RunStep]`（枚举：plan/toolCall/observation/error）
  - `contextItems: [ContextItem]`（auto vs attached）
  - `approvals: [ApprovalRequest]`（待确认动作）
  - `providerState: ProviderState`（provider/model/usage）
  - `connectionState: connected|starting|stopped|error`
- **事件来源**
  - Agent（Node）通过 JSONL：
    - request/response：用于显式调用（initialize、run、setProvider…）
    - notification：用于流式输出、timeline step、web 证据、日志
- **建议的 JSONL 通知种类（与 UI 对齐）**
  - `ui/log`：纯日志（进 Timeline 也可）
  - `ui/step`：新增/更新某一步（含 stepId、title、status）
  - `ui/plan`：计划文本或结构化步骤（用于 Plan-first 模式展示与确认）
  - `ui/approval.request`：请求授权（type=writeFile/runCommand/web）
  - `ui/approval.result`：授权结果（approved/denied）
  - `ui/diff.available`：提示可拉取 diff（触发客户端调用 git diff 或 agent 直接给）
  - `ui/web.searchResult` / `ui/web.page`：Web 证据

> 说明：这部分可以逐步演进；MVP 也可先只用 `ui/log` + `ui/approval.request` + 最终回答。

## 执行模式（Plan-first vs Auto-run）

- **目的**：把“展示执行轨迹”与“用户是否要先看计划再执行”分离。时间线永远可见；执行模式决定是否允许进入工具执行阶段。
- **Plan-first（先计划后执行）**
  - Agent 只输出计划（如 `ui/plan` 或 `ui/step` 的 plan 阶段），不触发工具调用。
  - UI 提供：
    - “批准并执行”按钮（将计划确认信号回传给 agent）
    -（可选）允许用户编辑计划步骤
- **Auto-run（自动执行）**
  - Agent 直接进入 tool call/observation。
  - 仍保留授权弹层：写文件/跑命令/访问 Web 需要用户明确允许。
- **UI 交互建议**
  - Toolbar 放一个 `Execution Mode` 下拉或 segmented control。
  - 输入框旁放一个小按钮：`Plan`（只生成计划）/`Run`（按当前模式执行）。

## Diff（基于 git diff 文本）设计

- **生成方式**：客户端在“发现工作区有改动”时运行 `git diff`（或由 agent 触发），拿到 unified diff 文本。
- **展示方式（MVP）**：
  - 文件列表（从 diff 里解析 `diff --git a/... b/...`）
  - 点击文件 → 展开对应 hunks
- **应用方式（MVP）**：
  - 不在 UI 内做逐 hunk apply；先做“接受全部改动（保持工作区改动）/放弃全部改动（git checkout -- .）”的按钮。
  - 下一步再做文件级、hunk 级 apply。

## SwiftUI 组件拆分（建议）

- `AppShellView`：三栏布局 + toolbar
- `SidebarView`：会话/上下文
- `ChatView`：消息列表 + 输入框 + 流式追加
- `InspectorView`：Timeline/Diff/Web tabs
- `TimelineView`：步骤卡片（可折叠）
- `DiffView`：diff 文件列表 + hunks
- `ApprovalSheet`：授权弹层卡片

## 代码落点（你现有 POC 目录）

- SwiftUI 客户端在：
  - `sandbox/codex-jsonl-poc/swiftui-client/Sources/CodexJSONLClient/`
  - 关键文件：`AgentClient.swift`, `AgentViewModel.swift`, `ContentView.swift`
- Node 侧在：
  - `sandbox/codex-jsonl-poc/node-agent/index.js`

## 迭代顺序（最小可用 → 可演示）

- **迭代 1：连接 + 聊天 + 流式日志**
  - SwiftUI 能启动 Node agent，显示连接状态
  - Timeline 至少能显示 RX/TX 日志与心跳通知
- **迭代 1.5：执行模式切换（Plan-first / Auto-run）**
  - Toolbar 可切换模式
  - Plan-first：发送同一任务时只产出计划，不执行工具
  - 点击“批准并执行”后，才进入执行阶段并在 Timeline 中出现 tool call/observation
- **迭代 2：时间线结构化**
  - Node 发 `ui/step` 通知，SwiftUI 用卡片展示 plan/tool/observation
- **迭代 3：安全确认（F6 风格）**
  - Node 发 `ui/approval.request`，SwiftUI 弹出同意/拒绝
  - SwiftUI 回传授权结果，Node 决定是否继续
- **迭代 4：Diff（git diff）**
  - SwiftUI 运行 `git diff` 并展示在 Diff tab
  - 提供“复制 diff / 打开文件”
- **迭代 5：Provider/Web 展示**
  - Provider 状态条 + 切换
  - Web 证据 tab：来源列表

## 风险与注意事项

- **JSONL/stdio 分帧**：UI 的“流式”体验取决于 Node 端是否分段发送通知；现有协议是行级消息。
- **线程安全**：SwiftUI 更新状态应回到主线程；AgentClient 需要确保回调与状态更新不竞态（这与你前面 P0 修复建议一致）。
- **git diff 调用**：需要工作区是 git repo；否则 Diff tab 需显示“当前目录非 git 仓库/无 diff”。

