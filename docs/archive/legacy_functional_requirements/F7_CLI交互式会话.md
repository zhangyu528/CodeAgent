# Feature 需求：F7 - CLI 交互式会话管理 (Interactive Session & Chat Management)

## 1. 背景与目标
CodeAgent 既是自动化执行工具，也是开发者在终端中的持续对话助手。为了保证真实可恢复的会话体验，CLI 与 Runtime 需要明确分层：CLI 负责交互与渲染，Runtime 负责会话语义与持久化。

**目标**：打造具备流式响应、可恢复会话、会话控制指令的高效终端交互系统。

## 2. 核心功能点

### 2.1 基础对话与流式输出 (Streaming Response)
- 接收用户自然语言指令并流式输出。
- 等待首个 token 期间展示 thinking 状态。

### 2.2 上下文记忆与管理 (Context Memory & Sliding Window)
- 继续使用 Token 滑窗（约 4000 tokens）保证上下文稳定。
- MemoryManager 负责窗口裁剪；session 历史由 Runtime 持久化并在恢复时重放。

### 2.3 会话控制指令 (Slash/Meta Commands)
- `/clear`：创建并切换到新 session（旧 session 保留，可后续继续）。
- `/history`：查看最近 session 列表（标题、状态、模型、更新时间）。
- `/exit` 或 `/quit`：结束当前 session 并优雅退出。

### 2.4 启动与恢复流程
- 欢迎界面首条非 slash 输入会创建新 session 并进入 chat 视图。
- 下次启动可选择“新建会话”或“继续上次会话”。
- 继续时回放历史消息后进入可输入状态。

## 3. 验收标准
- [x] `codeagent` 启动后进入欢迎界面。
- [x] 首条输入创建新 session 并进入交互区。
- [x] 重启后可选择继续上次 session，并看到历史回放。
- [x] `/clear` 切换到新 session，旧 session 可再次 resume。
- [x] `/exit`、`/quit` 正常结束当前 session。
- [x] `Ctrl+C` 中断流式时将 session 标记为 `interrupted`。

## 4. 技术方案
- **CLI**：负责欢迎页、命令输入、历史回放渲染与用户操作。
- **Runtime**：`SessionService + SessionRepository(SQLite)` 负责 session 创建/续接/结束/中断标记与消息持久化。
- **存储**：`sessions` + `messages` 两表，支持 recent list 与消息顺序读取。
- **流式渲染**：继续使用 provider 的 stream 输出；历史回放展示最终态，不重放打字机动画。