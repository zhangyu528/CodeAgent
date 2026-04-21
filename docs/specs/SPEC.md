# CodeAgent Specification

> 本文档描述 CodeAgent 的完整架构和实现细节。Generated from source code analysis — April 2026.

---

## 1. Overview

**CodeAgent** 是一个基于 `@mariozechner/pi-coding-agent` 构建的 AI 终端编程助手，提供两种运行模式：

| 模式 | 触发 | 用途 |
|------|------|------|
| **Ink TUI** (默认) | 终端直接运行 `bun run dev` | 交互式全屏对话界面 |
| **JSON Mode** | `codeagent --json --prompt "..."` | 非交互式 NDJSON 输出，适合管道和脚本 |

**技术栈**：TypeScript ESM + Bun + Ink/React TUI + Zustand + Zod + Vitest

---

## 2. 项目结构

```
src/apps/
├── core/                    # 核心业务逻辑层（唯一导入 pi-coding-agent 的层）
│   ├── index.ts            # 对外 API 统一导出
│   ├── agent.ts            # AgentSession 单例工厂
│   ├── apiKey.ts           # AuthStorage 封装（API Key 持久化）
│   ├── modelDiscovery.ts   # ModelRegistry 缓存层（zai, minimax-cn）
│   ├── logger.ts           # Consola 日志 → ~/.codeagent/logs/codeagent.log
│   └── logViewer.ts        # PowerShell 日志窗口 [dev only]
│
├── cli/                     # 应用入口
│   ├── index.tsx           # 入口：TTY 检查、Flag 解析、Bootstrap
│   │
│   ├── ink/                # Ink TUI（Ink + React）
│   │   ├── App.tsx         # 根组件 — 页面路由
│   │   ├── AppController.ts # 页面生命周期 + 终端尺寸响应
│   │   ├── useKeyboardShortcuts.ts  # Ctrl+C/Ctrl+D 二次确认退出
│   │   │
│   │   ├── pages/
│   │   │   ├── types.ts          # ChatMessage / ChatMessageBlock 类型定义
│   │   │   ├── init/InitPage.tsx # Agent 初始化等待页（加载动画）
│   │   │   ├── welcome/WelcomePage.tsx  # 欢迎页 + Logo + 首次运行检测
│   │   │   ├── welcome/Logo.tsx         # ASCII Logo
│   │   │   ├── welcome/constants.ts      # 欢迎页文案
│   │   │   └── chat/ChatPage.tsx        # 主聊天页 + Agent 事件绑定
│   │   │
│   │   ├── components/
│   │   │   ├── inputs/
│   │   │   │   ├── InputController.ts   # 键盘输入处理 + 提交逻辑
│   │   │   │   ├── input.tsx            # 输入框组件（prompt 状态栏）
│   │   │   │   ├── InputField.tsx       # 样式化文本字段
│   │   │   │   ├── SlashList.tsx       # 命令面板弹出层
│   │   │   │   ├── SlashListController.ts  # 命令过滤 + 执行
│   │   │   │   ├── useSlashCommands.ts    # 命令注册表 + executeSlash()
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── modals/
│   │   │   │   ├── ModalContainer.tsx  # 渲染所有 Modal
│   │   │   │   ├── ModalFrame.tsx      # 通用 Modal 边框/标题/页脚
│   │   │   │   ├── visibility.ts      # Modal 可见性状态（单例）
│   │   │   │   ├── textLayout.ts       # padToWidth / wrapToWidth 工具
│   │   │   │   ├── AskModal.tsx        # 文本输入弹窗
│   │   │   │   ├── ConfirmModal.tsx    # 确认对话框
│   │   │   │   ├── NoticeModal.tsx     # 通知信息弹窗
│   │   │   │   ├── SelectOneModal.tsx  # 单项选择列表弹窗
│   │   │   │   ├── PromptBox.tsx      # Modal 内置文本输入框
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── ChatHeader.tsx      # 会话标题 + Token 使用量显示
│   │   │   │   ├── MessageList.tsx     # 可滚动消息列表（ink-scroll-view）
│   │   │   │   ├── MessageItem.tsx     # 单条消息渲染（支持多种 Block 类型）
│   │   │   │   ├── DateDivider.tsx     # "今天"/"昨天"/日期 分隔线
│   │   │   │   ├── TypingIndicator.tsx # "..." / "Generating..." 动画
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── ErrorBoundary.tsx       # React Error Boundary
│   │   │
│   │   ├── store/
│   │   │   ├── index.ts                # 导出
│   │   │   ├── chatStore.ts            # 统一 Session + Message 状态
│   │   │   ├── uiStore.ts              # 页面路由 + UI 状态
│   │   │   └── schemas.ts              # Zod Schema（类型单一来源）
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAgentEvents.ts       # AgentSession 事件订阅 + 150ms 节流
│   │   │   ├── useModelConfig.ts       # 模型配置状态机
│   │   │   ├── useProviderConfig.ts    # Provider/Model 选择 UI 辅助函数
│   │   │   ├── useTokenTracking.ts     # Token 使用量显示逻辑
│   │   │   └── index.ts
│   │   │
│   │   └── utils/
│   │       ├── utils.ts                # shortenPath / getCurrentDateString
│   │       └── messageAdapters.ts      # agentMessages → ChatMessage 转换器
│   │
│   └── json/                # JSON 输出模式
│       ├── JsonMode.ts     # Agent 事件 → JSON 事件映射
│       ├── emitter.ts      # NDJSON stdout 写入器
│       ├── flags.ts        # CLI Flag 解析（--json, --prompt, --session）
│       ├── types.ts        # JsonEvent 类型定义
│       └── index.ts

docs/specs/                   # 架构规格文档
tests/                        # Vitest 测试
```

---

## 3. Core 层（`src/apps/core/`）

Core 层是**唯一**直接导入 `pi-coding-agent` 的层。所有其他层（`ink/`、`json/`）只能通过 `core/index.ts` 的导出与 Agent 交互。

### 3.1 `agent.ts` — AgentSession 单例

```
ensureAgentInitialized()
  → 创建 AuthStorage 实例
  → 调用 createAgentSession({ authStorage, agentDir, tools, cwd })
  → 返回 session 单例（后续调用返回同一 Promise）
getAgentSession()
  → 同步访问已初始化的单例（未初始化则抛出异常）
```

**注册的工具**：`codingTools`（来自 pi-coding-agent）+ `findTool` + `grepTool` + `lsTool`

**数据目录**：`~/.codeagent/`（通过 `getCodeAgentDir()` 计算）

### 3.2 `apiKey.ts` — API Key 管理

使用 `AuthStorage`（来自 pi-coding-agent）实现持久化：

| 函数 | 行为 |
|------|------|
| `getAuthStorage()` | 惰性单例，路径 `~/.codeagent/auth.json` |
| `checkApiKeyConfigured(provider)` | 返回 boolean |
| `saveApiKey(provider, apiKey)` | 验证后保存（长度≥8，无控制字符） |
| `removeApiKey(provider)` | 从 AuthStorage 删除 |
| `isFirstRun()` | 无 API Key 且无会话文件时返回 true |

### 3.3 `modelDiscovery.ts` — 模型发现

对 `ModelRegistry` 的缓存封装，仅暴露允许的 Provider：

- **允许列表**：`zai`、`minimax-cn`
- `ensureProvidersLoaded()`：缓存填充中会阻塞等待
- `reloadProviders()`：清空缓存重新发现（保存新 API Key 后调用）

### 3.4 `logger.ts` — 日志

- **引擎**：Consola（level = `Infinity`，全量通过）
- **开发模式**（`NODE_ENV !== 'production'`）：console + 文件
- **生产模式**：仅文件
- **日志路径**：`~/.codeagent/logs/codeagent.log`
- **格式**：`[timestamp] [LEVEL] message`

### 3.5 `logViewer.ts` — 日志窗口（仅开发模式）

- `openLogViewer()`：衍生 PowerShell 窗口，尾随日志文件，PID 写入 `~/.codeagent/logs/logviewer.pid`
- `closeLogViewer()`：通过 `taskkill /PID` 终止窗口进程

---

## 4. 状态管理

### 4.1 `uiStore.ts` — UI 状态

```typescript
type PiPage = 'init' | 'welcome' | 'chat';

interface AppStoreState {
  page: PiPage;
  isFirstPress: boolean;      // Ctrl+C 第一次按键（显示退出提示）
  currentModel: string | null;
  pendingPrompt: string | null; // WelcomePage 暂存的待发送 Prompt
  hasModalOpen: boolean;
}
```

### 4.2 `chatStore.ts` — 统一会话 + 消息状态

Session 和 Message 属于同一聚合（Session 包含 Messages），放在一个 Store 中保证 `clearAll()` 原子性：

```typescript
interface ChatStore {
  // Session State
  historyItems: SessionInfo[];
  currentSession: ChatSessionInfo | null;
  activeSessionId: string | null;
  pendingPrompt: string | null;

  // Message State
  messages: ChatMessage[];
  thinking: boolean;
  usage: { input, output, cost } | null;
}
```

**关键行为**：
- `refreshHistory(limit?)`：调用 `session.sessionManager.list()` 获取历史会话
- `restoreSessionById(id)`：调用 `session.switchSession(id)` 并从 `session.messages` 合入 Store
- `ensureSessionForPrompt(text)`：复用活跃 Session 或创建新 Session，标题取前 40 字符
- `persistCurrentSession()`：**500ms 防抖**更新本地状态；首次消息时调用 `session.setSessionName()`
- `clearAll()`：调用 `session.newSession()` 并原子性清空所有状态

### 4.3 `schemas.ts` — Zod Schema 作为类型来源

类型通过 `z.infer<>` 从 Schema 派生，确保运行时验证和编译时类型一致：

| Schema | 类型 |
|--------|------|
| `ChatMessageBlockSchema` | discriminated union: `text \| thinking \| reasoning \| toolSummary` |
| `ChatMessageSchema` | id, role, title, createdAt, status, blocks[] |
| `ChatSessionInfoSchema` | id, title, status, updatedAt, messageCount |
| `MessageStoreStateSchema` | messages[], thinking, usage |

---

## 5. 数据流

### 5.1 应用初始化

```
bootstrap()
  → openLogViewer()                    [dev only]
  → ensureAgentInitialized()            → createAgentSession()
  → render(<App initPromise={...}>)
      → AppController mounts (page='init')
      → InitPage 显示加载动画
      → initPromise resolves → setPage('welcome')
      → WelcomePage 显示
```

### 5.2 Prompt 流程（Welcome → Chat）

```
User 在 WelcomePage 输入 Prompt 并按 Enter
  → InputController.submitPrompt()
      → useChatStore.ensureSessionForPrompt()    [创建/复用 Session 元数据]
      → useChatStore.setPendingPrompt()           [暂存 Prompt 供 ChatPage 读取]
      → useAppStore.setPage('chat')
  → ChatPage 挂载（useEffect 触发一次）
      → useChatStore.getAndClearPendingPrompt()   [读取并清空暂存的 Prompt]
      → useChatStore.addMessage()                  [添加用户消息]
      → session.prompt(pendingPrompt)             [发送给 Agent]
```

### 5.3 Agent 事件 → UI 更新

```
AgentSession emit 事件
  → useAgentEvents 订阅（位于 ChatPage）
      · 'agent_start':
          addMessage() 添加空的 assistant 消息
          setThinking(true)
      · 'message_update':
          text_delta / thinking_delta 加入节流 Buffer
      · 'message_end':
          flushDeltas() 刷新 Buffer
          setUsage() 更新 Token 统计
          updateLastMessage() 设置最终状态
      · 'agent_end':
          flushDeltas() + stopThrottle()
          persistCurrentSession()  [防抖 500ms]
```

### 5.4 流式节流（Streaming Throttle）

- Text 和 Thinking delta 在 **150ms 间隔窗口**内缓冲
- `flushDeltas()` 在定时器触发或 `agent_end` 时调用
- 防止高频 Token 更新引发 React 重新渲染风暴

---

## 6. Slash 命令

| 命令 | 处理函数 | 行为 |
|------|---------|------|
| `/help` | `showNotice(HELP_MESSAGE)` | 显示命令列表 |
| `/new` | `clearAll()` + `setPage('welcome')` | 新建会话 |
| `/model` | `modelConfig.startConfig()` | 打开模型选择器 |
| `/history` | `openHistoryModal()` | 浏览/恢复历史会话 |
| `/resume` | `refreshHistory(1)` + `restoreSessionById()` | 恢复最近会话 |
| `/quit` | `exit()` | 退出应用 |

前缀匹配：`/h` → `/help`，`/hi` → `/history`（最长匹配优先）。

---

## 7. Modal 系统

四个自包含的 Modal，通过 reducer + 全局 ref 分派器模式管理：

| Modal | 触发方式 | 用途 |
|-------|---------|------|
| `AskModal` | `showAsk({title, message, onSubmit, onCancel})` | 文本输入 |
| `ConfirmModal` | `showConfirm({title, message, onSubmit, onCancel})` | 确认对话框 |
| `NoticeModal` | `showNotice({title, message, footer})` | 通知信息 |
| `SelectOneModal` | `showSelectOne({title, choices, onSubmit, onCancel})` | 单项选择 |

每个 Modal 在 `useEffect` 中设置模块级 `dispatch` ref。`show*()` 函数向该 ref 分派动作。`ModalContainer` 渲染全部四个 Modal，可见性由 reducer 状态控制。

`visibility.ts` 中的 `modalVisibility` 单例追踪当前打开的 Modal（`notice | confirm | ask | selectOne | null`），供 `useModalOpenState()` hook 使用。

---

## 8. JSON Mode（`--json`）

激活条件：`--json` CLI Flag。跳过 TTY 检查。

```
runJsonMode(flags)
  → ensureAgentInitialized()
  → initJsonMode()           [setJsonMode(true)]
  → session.subscribe(handleAgentEvent)
      · 'message_end':      emit({type: 'response', content, model})
      · 'message_update':   emit({type: 'response', content: delta}) [text_delta]
  → if --session: restoreSessionById()
  → if --prompt: session.prompt(prompt)
```

**NDJSON 事件类型**（`types.ts`）：

| type | 字段 |
|------|------|
| `response` | content, model |
| `tool_call` | tool, args |
| `tool_result` | tool, result, success |
| `error` | code, message |

---

## 9. 键盘交互

### 输入组件

| 按键 | 行为 |
|------|------|
| `Enter` / `Return` | 提交 Prompt 或执行 Slash 命令 |
| `Backspace` / `Delete` | 删除最后一个字符 |
| `Escape` | 清空输入框 |
| 字符键 | 追加到输入（无 Modal 打开时） |
| `/` 在开头 | 显示命令面板（仍保留在输入框中） |

### 消息列表

| 按键 | 行为 |
|------|------|
| `↑` / `↓` | 滚动 1/3 视口 |
| `PageUp` / `PageDown` | 滚动整屏 |
| 鼠标滚轮（xterm 序列） | 同方向键 |
| 自动固定底部；手动上滚后显示未读指示器 |

### 退出流程

- `Ctrl+C` 或 `Ctrl+D`：第一次按键显示 2 秒提示横幅，第二次按键（2 秒内）真正退出。

---

## 10. 存储结构

所有持久化数据统一在 `~/.codeagent/` 目录下：

| 路径 | 内容 |
|------|------|
| `~/.codeagent/auth.json` | API Key（AuthStorage） |
| `~/.codeagent/sessions/` | 会话文件（JSON） |
| `~/.codeagent/sessions.db` | SQLite 会话数据库 |
| `~/.codeagent/logs/codeagent.log` | 应用日志 |
| `~/.codeagent/logs/logviewer.pid` | 日志窗口进程 ID [dev only] |

---

## 11. 测试

测试运行器：**Vitest** + `@vitest/ui`

| 目录 | 类型 | 内容 |
|------|------|------|
| `tests/unit/apps/cli/json/` | 单元 | flags, emitter, types, CLI 输出 |
| `tests/unit/apps/cli/ink/store/` | 单元 | chatStore, schemas |
| `tests/unit/` | 单元 | useAgentEvents 节流, useSlashCommands, useModelConfig, uiStore, inputLogic, textLayout, modalReducers, visibility, utils, types |
| `tests/components/` | 组件 | AskModal, ChatHeader, ConfirmModal, DateDivider, ErrorBoundary, Input, InputField, MessageList, ModalContainer, ModalFrame, NoticeModal, PromptBox, SelectOneModal, SlashList, TypingIndicator, WelcomePage |
| `tests/pages/init/` | 页面 | InitPage |
| `tests/integration/` | 集成 | modelSelectionComplete, modelSelectionFlow |

**测试基础设施**：
- `ink-testing-library`：渲染 Ink 组件
- `vi.useFakeTimers()` + `vi.advanceTimersByTime()`：节流间隔测试

---

## 12. 依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `@mariozechner/pi-coding-agent` | ^0.61.1 | 核心 Agent、Session 管理、工具集 |
| `ink` | ^6.8.0 | TUI 渲染框架 |
| `react` | ^19.0.0 | UI 库 |
| `zustand` | ^5.0.12 | 状态管理 |
| `zod` | ^4.3.6 | Schema 验证 |
| `ink-scroll-view` | ^0.3.6 | 消息列表滚动视图 |
| `@byteland/ink-scroll-bar` | ^1.0.0 | 滚动条 |
| `consola` | ^3.4.2 | 日志 |
| `vitest` | ^4.1.2 | 测试运行器 |
| `husky` | ^9.1.7 | Git Hooks |
