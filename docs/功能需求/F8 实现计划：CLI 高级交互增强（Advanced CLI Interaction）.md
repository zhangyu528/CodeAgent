## F8 实现计划：CLI 高级交互增强（Advanced CLI Interaction）

### Summary
- 在不改变现有 Agent 工具体系（`Tool` + `AgentController` 事件流）的前提下，引入一层“CLI UI 适配器（UIAdapter）”，统一承载：Diff 渲染、交互选择、编辑器输入、工具进度折叠、安全确认面板、快捷键与补全。
- 对“会修改文件内容”的工具（至少 `write_file` / `replace_content`）增加**变更预览（彩色 unified diff）+ 用户确认**，实现“修改前可视化”。

---

### Key Changes（Decision-complete）

#### 1) Rich Diff Rendering（写入前 Diff 预览）
- 新增依赖：`diff`（生成 unified diff），继续使用 `chalk` 上色。
- 新增模块：`src/cli/diff_renderer.ts`
  - 输入：`oldText`, `newText`, `filePath`, `contextLines=3`
  - 输出：Git-style unified diff 字符串（`+` 绿、`-` 红、`@@` 青/灰、上下文灰）
- 在 `AgentController` 的工具执行链路加“中间件”：
  - 仅对 `write_file` / `replace_content` 生效：
    - 执行前读取旧内容（不存在则旧内容为空）
    - 计算新内容（`replace_content` 需在内存中先替换得到 `newText`，不直接落盘）
    - 渲染 diff → 调用 UIAdapter 进行展示 → `confirm` 通过才允许继续执行工具
  - 用户拒绝则返回工具错误串给模型（例如 `Error: User denied changes after diff preview.`）
- 默认策略：**只要目标文件已存在或新内容长度 > 500 字符，就必须确认**；否则仍展示 diff，但可通过环境变量关闭确认：
  - `DIFF_CONFIRM=always|smart|off`（默认 `smart`）

#### 2) Interactive Selection（交互式选择菜单）
- 新增 2 个 Tool（给 LLM 显式调用，覆盖“多选场景”）：
  - `user_select`：单选（方向键），参数：`message`, `choices: string[]`, `default?: string`, `enableSearch?: boolean`
  - `user_checkbox`：多选（空格勾选），参数：`message`, `choices: string[]`, `defaults?: string[]`, `enableSearch?: boolean`
- 实现使用 `@inquirer/prompts`：
  - `choices.length > 12` 或 `enableSearch=true` 时，走 `search()`（关键词过滤）；否则走 `select()/checkbox()`
- 返回值：JSON 字符串 `{ selected: string }` 或 `{ selected: string[] }`

#### 3) Embedded Editor Mode（终端编辑器输入）
- 新增 Tool：`user_editor`
  - 参数：`message`, `initial?: string`
  - 实现：`@inquirer/prompts` 的 `editor()`，返回 `{ text: string }`
- REPL 增加命令：`/edit`
  - 直接打开编辑器，保存后将内容作为一次 user prompt 发送给 Agent（等价于粘贴长任务）
- 同时支持块输入（不依赖外部编辑器）：`<<EOF` … `EOF`
  - 在 REPL 层实现（见第 6 点 readline 重构）

#### 4) Tool Execution Bubbles / Progress（工具执行状态折叠）
- 新增依赖：`log-update`（TTY 原地刷新；非 TTY 降级为普通日志）
- 新增模块：`src/cli/tool_bubbles.ts`
  - 维护最近 N 条工具执行条目（建议 N=8）：
    - `id`（递增）、`toolName`、`argsPreview`、`status: running|ok|err`、`startedAt/endedAt`
  - 订阅 `AgentController` 事件：
    - `onToolStarted`：新增一行 spinner 状态
    - `onToolFinished`：行状态变 ✅ 或 ❌，并缓存完整 `result` 用于展开
- REPL 增加命令用于“展开详情”（代替需求里的“点击”）：
  - `/tools`：列出最近工具列表（id、name、状态、耗时）
  - `/tool <id>`：打印该工具的完整 args + 完整 result（必要时分段/截断）

#### 5) Enhanced Security Prompt（高危操作增强确认）
- 引入 `UIAdapter.confirmRisk()`（替代当前单行 confirm）：
  - 展示多行内容（允许 ANSI 颜色）：
    - 标题：`[HIGH RISK]` / `[MEDIUM]` / `[LOW]`
    - 详情：命令/URL 原文（高亮）
    - 原因：命中规则（例如敏感 pattern、非标准端口）
- `SecurityLayer.requestApproval()` 保持对外签名不变，但内部改为接受结构化描述字符串模板（统一格式），交由 UIAdapter 解析渲染；或新增重载 `requestApproval(ctx)`（实现时二选一并统一调用点）。

#### 6) Global Keybindings + Tab 补全（readline 重构 REPL）
- 将 REPL 输入从 `@inquirer/prompts.input()` 改为 Node `readline`（`readline.createInterface` + `completer`）：
  - 目的：实现 `Tab` 补全与全局快捷键，不与 inquirer 输入竞争
- 快捷键行为（仅在“等待用户输入”或“流式输出中”生效）：
  - `Ctrl+L`：`console.clear()` + 执行 `/clear`（清会话）+ 清空 tool bubbles 面板
  - `Ctrl+C`：
    - 若正在 `askStream`：通过 AbortController 终止（见下一条）
    - 若在等待输入：保持默认（退出或取消当前行）
- 中断能力（最小可用实现）：
  - 为 `AgentController.askStream()` 增加可选 `AbortSignal`
  - 为 provider（至少 GLMProvider）fetch 增加 `signal` 支持
  - REPL 维持一个“当前请求 AbortController”，`Ctrl+C` 调用 `abort()`
- Tab 补全策略（不做复杂 AST 解析，保证可交付）：
  - 以空格分词，补全最后一个 token：
    - 以 `/` 开头：补全 `/model /clear /history /edit /tools /tool`
    - 否则：补全工作区相对路径（目录/文件名），支持 `./`、`src/` 前缀

---

### Test Plan
- Unit
  - `diff_renderer`：给定 old/new 输出包含 `+`/`-`/`@@` 且颜色标记正确（可用去 ANSI 后断言结构）
  - `tool_bubbles`：状态机测试（started→finished ok/err）、缓存与截断策略
  - `readline completer`：给定输入与文件树（mock fs）返回预期候选
- Integration（不依赖网络）
  - 用现有 `MockProvider` 触发 `write_file/replace_content` 工具调用，注入一个测试用 UIAdapter：
    - 断言：执行前调用了 “render diff + confirm”
    - confirm=false 时工具不执行，返回拒绝错误串
  - `user_select/user_checkbox/user_editor`：注入 UIAdapter stub 返回固定值，断言 Tool 返回 JSON 正确
- Manual（TTY 验收）
  - 实机运行 `npm start`：
    - 修改文件时出现彩色 diff，并可确认/拒绝
    - 多工具连续执行时不刷屏，`/tools` 可展开
    - `Ctrl+L` 清屏并重置会话；`Ctrl+C` 可中断流式输出；`Tab` 可补全路径与命令

---

### Assumptions / Defaults
- “点击展开”在纯终端环境用命令替代：`/tools` 与 `/tool <id>`。
- Diff 预览默认开启；确认策略默认 `smart`（可通过 `DIFF_CONFIRM` 覆盖）。
- Keybindings 与 Tab 补全以 readline REPL 为准；inquirer 仅用于选择/确认/editor 三类弹窗，避免输入模式冲突。
