# Feature 需求：F9 - CLI 界面全功能需求（Streaming UI + Status Bar + Keybindings）

## Summary
F9 目标是在现有“流式输出 + 命令式 REPL”的基础上，把 CLI 界面能力做成**可规格化、可验收、可扩展**的一套 UI 规范与实现清单。本期 UI 形态确定为：**流式滚动为主 + 固定状态栏**；新增重点为：**快捷键体系**（中断、清屏、历史等）。不做全屏 TUI 固定分区。

## 1. Goals / Non-Goals
### Goals
- 用户进入 CLI 后 3 秒内明确：当前 workspace、默认 Provider、可用 Provider、如何开始、如何退出、常用命令。
- 交互过程清晰区分：用户输入、系统状态、模型输出、工具执行、风险确认、错误信息。
- 状态栏常驻展示关键运行态：Provider、模式（idle/streaming/capturing/confirm）、token/telemetry、最近工具状态。
- 提供一致的快捷键体系：中断生成、清屏、输入历史、补全，且在 Windows PowerShell 的 TTY 下行为稳定。

### Non-Goals
- 不引入全屏 TUI（不做固定分屏：欢迎/输入/日志/工具等）。
- 不在 F9 内扩展 Agent/LLM 能力（模型策略、规划算法、工具能力不属于 UI）。
- 不承诺跨终端完全一致（Windows Terminal / iTerm / VSCode terminal 等差异只做兼容性说明）。

## 2. UI 信息架构（概念区域，不是分屏）
1. **启动与欢迎（Boot/Welcome）**
- Preflight：加载 `.env`、Provider 注册结果、默认 Provider 选择结果、（可选）跳过原因摘要。
- Workspace Trust：未信任目录时强制拦截确认，拒绝即退出。
- Welcome：极简显示，包含产品名+版本、Provider 信息，版本与 Provider 之间有空行间隔。不展示 workspace、快捷键或额外的状态说明。

2. **状态栏（Status Bar，常驻一行或两行）**
- 字段（固定顺序）：`Provider` | `Mode` | `ContextTokens` | `SessionTokens` | `Cost` | `LastTool`。
- 默认状态：可通过配置文件（`.env`）中的 `STATUS_BAR=0` 彻底关闭。
- Mode 枚举：
- `IDLE` 等待输入
- `THINKING` spinner 运行中
- `STREAMING` 正在流式输出
- `CAPTURE` 多行输入中（提示用 `... `）
- `CONFIRM` 风险/差异确认中（阻塞输入）
- 刷新策略：
- 工具开始/结束、开始流式/结束流式、token 更新、进入 capture/confirm 时刷新。
- 非交互（非 TTY）：
- 禁用状态栏，仅输出关键日志行（避免破坏管道输出）。

3. **输入（Prompt/Input）**
- 单行输入：`CodeAgent > `
- 多行输入：输入 `<<EOF` 进入捕获，直到用户输入单行 `EOF` 才提交。
- 编辑器输入：`/edit` 打开编辑器提交（TTY 才可用）。
- 输入历史：上下键切换历史；支持恢复上一条未提交输入（可选）。

4. **命令（Slash Commands）**
- 必备命令（至少）：
- `/model [name]` 查看/切换 Provider
- `/clear` 清空会话上下文（memory + tool bubbles）
- `/history` 显示消息数与 tokens 粗略统计
- `/tools` 列出最近工具（id/name/status）
- `/tool <id>` 查看工具参数与结果摘要
- `/edit` 编辑器输入
- `/help` 输出命令速查（F9 新增，替代“记不住命令”的问题）
- 命令错误规范：
- 未知命令：输出一行错误 + 紧跟 `/help` 提示。
- 参数错误：输出用法示例（不输出长帮助）。

5. **输出（Streaming Output + Rendered Output）**
- 流式输出：逐 chunk 直接写 stdout。
- 完整渲染：流结束后对整段输出做一次格式化渲染（Markdown 终端渲染），并在渲染前后插入可读的分隔样式（不影响复制）。
- 中断输出：被快捷键中断时输出统一标记 `[Interrupted]`，并回到 `IDLE`。

6. **工具可观测（Tool Bubbles / Tool Timeline）**
- 工具开始/结束以“可折叠/可回查”为目标：
- 最近 N 条工具以 bubble 方式显示（TTY 下增强；非 TTY 下退化为一行日志）。
- `/tools` 与 `/tool <id>` 必须能回看 args/result（必要时截断）。

7. **安全与确认（Security/Confirm）**
- Workspace Trust：启动必经。
- 风险确认：执行敏感命令、浏览页面、写文件差异确认（diff preview）。
- 统一确认文案结构：风险级别 + 标题 + detail + reason + Allow?（交互阻塞，Mode=CONFIRM）。

## 3. 快捷键体系（F9 本期新增重点）
在 **TTY** 模式下生效；非 TTY 下忽略。
- `Ctrl+C`：
- 若正在 `STREAMING/THINKING`：中断当前生成（Abort），打印 `[Interrupted]`，回到 `IDLE`，不退出进程。
- 若在 `IDLE` 且输入为空：打印一次提示（例如“Press Ctrl+D to exit”），不退出。
- 若在 `CAPTURE`：提示如何退出 capture（例如输入 `EOF` 或 `Ctrl+C` 取消本次 capture），并回到 `IDLE`（取消 capture）。
- `Ctrl+D`：退出进程（等价 `exit`）。
- `Ctrl+L`：清屏但不清上下文（等价 terminal clear）；状态栏重绘一次。
- `Up/Down`：输入历史导航。
- `Tab`：命令与文件路径补全（至少补全 `/` 命令与 provider 名称）。
- 冲突处理：当 UIAdapter 进入 confirm/editor 时，快捷键不应破坏 prompt 状态（Mode=CONFIRM 时仅允许确认交互）。

## 4. Public API / Config（面向用户的开关）
- `DEFAULT_PROVIDER`：启动默认 provider（不合法时回退并提示）。
- `NO_COLOR=1`：禁用彩色输出（包含状态栏）。
- `STATUS_BAR=0|1`：显式关闭/开启状态栏（默认 TTY 开启）。
- `TOOL_BUBBLES=0|1`：显式关闭/开启工具 bubble（默认 TTY 开启）。
- 现有 `DIFF_CONFIRM` 继续生效，并在 `/help` 中可见说明。

## 5. Acceptance Criteria（可验收条目）
- 启动后展示欢迎区：标题、workspace、provider、常用命令速查；无 provider 时给出最短修复指引并退出。
- 未信任 workspace 时强制确认；拒绝则退出且不进入 REPL。
- 状态栏在 TTY 常驻显示，并在以下事件刷新：开始思考、开始/结束流式、工具开始/结束、切换 provider、进入/退出多行输入、进入确认框。
- `/help` 能列出所有命令及用法；未知命令会提示 `/help`。
- `Ctrl+C` 在生成中必然中断，显示 `[Interrupted]`，不会让 REPL 卡死或退出。
- `Ctrl+L` 仅清屏，不清 memory；`/clear` 清 memory 与 bubbles。
- 非 TTY 模式不会显示状态栏，不会卡在确认交互（确认默认拒绝并返回错误信息）。

## Assumptions
- 目标运行环境优先 Windows PowerShell + TTY；其他终端按“尽力兼容”。
- 状态栏实现不引入全屏 TUI 依赖，只做单行/双行的 redraw（TTY 下）。
- F9 文档覆盖“现状规范化 + 本期新增大功能（状态栏 + 快捷键 + /help）”，其余增强（命令面板、主题系统、会话导出）作为后续迭代候选。
