# F9 实现计划：CLI 界面全功能需求（Streaming UI + Status Bar + Keybindings）

## Summary
- 目标：在现有“流式输出 + 命令式 REPL”基础上，落地一套可规格化、可验收、可扩展的 CLI UI 能力。
- UI 形态：流式滚动为主 + 固定状态栏（非全屏 TUI）。
- 本期新增重点：快捷键体系（中断、清屏、历史、补全）与 `/help` 命令速查。

## 交付范围
- 启动与欢迎区：Preflight、Workspace Trust、Welcome（首屏信息完整可扫读）。
- 状态栏（TTY 默认开启）：展示 Provider、Mode、ContextTokens、SessionTokens、Cost、LastTool。
- Slash Commands：统一注册表管理，新增 `/help`，并规范未知命令与参数错误提示。
- 工具可观测：Tool bubbles 与状态栏统一渲染，不互相抢 stdout。
- 快捷键（TTY 生效）：Ctrl+C 中断生成、Ctrl+D 退出、Ctrl+L 清屏、历史与补全稳定。

## 实施步骤（按顺序执行）
1. 命令注册表与 `/help`
- 新增 `src/cli/slash_commands.ts`：集中定义 `/` 命令的 `name / usage / description / handler`。
- 迁移 `src/index.ts` 中现有命令分支到注册表：`/model`、`/clear`、`/history`、`/tools`、`/tool <id>`、`/edit`。
- 新增 `/help`：输出短表格或对齐列表，覆盖所有命令与用法。
- 规范命令错误：未知命令与参数错误统一提示一行错误 + “用 `/help` 查看”。

2. UI 状态机（Mode）与 HUD 渲染入口
- 新增 `src/cli/hud.ts`。
- 定义 Mode 枚举：`IDLE | THINKING | STREAMING | CAPTURE | CONFIRM`。
- 定义 HUDState：`provider`、`mode`、`contextTokens`、`sessionTokens`、`cost`、`lastTool`、`bubbleLines`。
- 提供 API：`setMode()`、`setProvider()`、`setTelemetry()`、`setLastTool()`、`render()`。
- 渲染策略：
- TTY 且 `STATUS_BAR!=0` 时启用统一重绘（建议使用 `log-update`）。
- 非 TTY 禁用 HUD，只输出关键日志行，避免破坏管道输出。

3. ToolBubbles 重构为“只产出文本”
- 调整 `src/cli/tool_bubbles.ts`：保留 items 管理，但不直接控制屏幕渲染。
- 新增 `getLines(): string[]`：返回 bubble 列表的多行文本。
- HUD 负责把 status bar 与 bubble lines 合成统一画面输出。
- 配置开关：`TOOL_BUBBLES=0|1`（默认 TTY 开启）。

4. `src/index.ts` 接入 HUD（状态栏刷新点与欢迎区）
- 初始化 HUD，打印 Welcome 区，保证首屏信息不超过约 12 行。
- 在关键事件刷新 HUD：
- 进入思考：Mode=THINKING。
- 收到第一段流式 chunk：Mode=STREAMING。
- 流结束与渲染完成：Mode=IDLE。
- 工具开始/结束：更新 lastTool 与 bubble lines。
- `/model` 切换：更新 provider 并刷新。
- 进入/退出多行 capture：Mode=CAPTURE/IDLE。
- 进入 confirm/editor：Mode=CONFIRM。
- Telemetry/token 更新：更新 context/session/cost。

5. 快捷键体系（TTY 优先，Windows PowerShell 稳定）
- 新增 `src/cli/keybindings.ts`：提供 `attachKeybindings({ rl, hud, getState, abortCurrent, cancelCapture, exit })`。
- 行为定义：
- Ctrl+C：
- STREAMING/THINKING 时中断当前生成（Abort），打印 `[Interrupted]`，回到 IDLE，不退出进程。
- CAPTURE 时取消 capture（清空 capture buffer），提示一次如何用 `EOF` 完成 capture，回到 IDLE。
- IDLE 且输入为空时提示 “Press Ctrl+D to exit.”，不退出。
- Ctrl+D：退出进程（等价 `exit`）。
- Ctrl+L：清屏但不清 memory，HUD 重绘并恢复 prompt。
- Up/Down：使用 readline 默认历史。
- Tab：使用现有 completer（下一步增强 `/model` 补全）。
- 仅在 `process.stdin.isTTY` 时启用 raw mode/keypress。

6. completer 增强：`/model ` 补全 provider 名称
- 改造 `src/cli/readline_completer.ts`：支持“命令参数补全”特判。
- 当输入以 `/model ` 开头时，候选取 `engine.listProviders()`。
- 继续支持 slash commands 补全与路径补全。
- `/help` 需要加入 slashCommands 列表。

7. confirm/editor 与快捷键/状态栏不冲突（suspendInput）
- 在 `src/index.ts` 实现 `suspendInput(fn)`：
- 暂停 readline prompt 与 keypress listener。
- HUD 切到 CONFIRM。
- 执行 `fn()`（inquirer confirm/editor）。
- 恢复 readline 与 keypress listener。
- HUD 回到之前 mode 并重绘。
- 通过 `DefaultUIAdapter` 构造参数注入 `suspendInput`，保证确认框与编辑器交互稳定。

8. 配置开关与无色模式
- 读取并支持：
- `STATUS_BAR=0|1`。
- `TOOL_BUBBLES=0|1`。
- `NO_COLOR=1`（尽量交给 chalk 处理，必要时启动时禁用彩色）。
- `/help` 中展示这些开关的简短说明。

9. 测试与验收
- 单测（可自动化）：
- HUD 的 mode/state 更新与输出字符串格式。
- `/help` 输出包含所有命令。
- completer 的 `/model` 参数补全。
- 手工验收（README 增一段脚本或 checklist）：
- 启动欢迎区首屏信息完整。
- 未信任 workspace 必拦截，拒绝即退出。
- `/help`、未知命令、参数错误提示符合规范。
- Ctrl+C 中断流式输出稳定，不退出不死锁。
- Ctrl+L 清屏不清上下文。
- 非 TTY 模式不渲染状态栏，不会卡在确认交互。

## 关键文件（预计改动点）
- `src/index.ts`
- `src/cli/hud.ts`（新增）
- `src/cli/slash_commands.ts`（新增）
- `src/cli/keybindings.ts`（新增）
- `src/cli/tool_bubbles.ts`（重构）
- `src/cli/readline_completer.ts`（增强）

## 风险与规避
- stdout 抢占与画面闪烁：统一由 HUD 渲染控制，ToolBubbles 不直接输出。
- inquirer 与 readline/raw mode 冲突：通过 `suspendInput` 进入 CONFIRM 模式并暂停 keypress。
- 非 TTY 行为：必须禁用状态栏与交互确认，保证脚本/管道输出稳定。
