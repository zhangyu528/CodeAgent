# Feature 需求：F7 - CLI 交互式会话管理 (Interactive Session & Chat Management)

## 1. 背景与目标
CodeAgent 的定位不仅是一个执行自动化任务的脚本，也是开发者在终端日常使用的“AI 助手”。为了提供流畅、自然的交互体验，我们需要在 CLI 界面中引入一套完善的“流式对话与会话管理”机制。

**目标**：打造一个具备持久记忆、流式响应体验、且支持基本控制指令的高效终端 REPL (Read-Eval-Print Loop) 对话界面。

## 2. 核心功能点

### 2.1 基础对话与流式输出 (Streaming Response)
- **功能**：接收用户的自然语言指令，并在终端以打字机效果（流式）实时渲染模型的回复。
- **要求**：
  - 必须支持大模型的 Stream API。
  - 在等待模型首个 Token 返回期间，需展示 Loading 动画（如 `Agent is thinking...` 循环。

### 2.2 上下文记忆与管理 (Context Memory & Sliding Window)
- **功能**：自动管理当前 Session 的对话历史，让多轮对话具备上下文连续性（如后续可直接问“怎么修复它？”）。
- **要求**：
  - 基于现有的 Token 滑动窗口机制（如 4000 tokens限制），确保长对话不会导致 Token 溢出。
  - 需要在底层维护一个 `messages` 数组，作为对话状态的来源。

### 2.3 会话控制指令 (Slash/Meta Commands)
- **功能**：提供内置的斜杠命令（Slash Commands），以便用户快捷管理会话状态。
- **必备指令**：
  - `/clear`：立刻清空当前会话的上下文记忆，开启全新的干净对话。
  - `/history`：查看当前会话的轮次统计或摘要。
  - `/exit` 或 `/quit`：安全保存状态并优雅退出 CodeAgent 交互界面。

### 2.4 多行输入与复杂文本支持 (Multiline Input)
- **功能**：允许用户在终端粘贴多行代码或复杂的长提示词。
- **要求**：
  - 传统终端按下回车即发送。需要引入特定前缀/后缀模式（例如以 `"""` 包裹）或快捷键支持，以区分“换行”与“发送命令”。

## 3. 验收标准
- [ ] 用户可以通过 `codeagent` 命令进入 `CodeAgent >` 提示符的交互模式。
- [ ] 连续发起 3 次以上的追问（如“这是什么？” -> “怎么改？” -> “再优化一下”），Agent 能够准确结合前置上下文回答。
- [ ] 输入 `/clear` 后，再次询问上一轮的话题，Agent 表现出不知情（成功清理上下文）。
- [ ] 在模型生成大段代码时，文本是平滑流出而不是卡顿数秒后瞬间全部打印。

## 4. 技术方案
- **CLI 交互库**：建议采用 `inquirer` 结合自定义的 readline 处理，或者使用现代化的终端 UI 库（如 `ink` 或 `enquirer`）来处理多行输入与 Loading 动画。
- **状态存储**：在 `AgentController` 内部或独立的 `SessionManager` 中维护 `currentConversation` 对象。
- **流式渲染**：对接 LLM Provider的流式接口，监听 `data` 事件，向 `process.stdout.write` 实时推流。
