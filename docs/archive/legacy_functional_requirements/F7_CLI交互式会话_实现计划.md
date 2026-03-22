# F7_CLI交互式会话_实现计划 (Implementation Plan)

## 1. 目标概述
为 CodeAgent 引入强大的 CLI 交互能力，使开发者能够在终端直接进行流畅的问答、请求代码生成并执行会话管理指令（例如 `/clear`，`/history` 等），提供“打字机式”流式输出与带历史记忆的多轮对话体验。

## 2. 核心模块设计

本特性将主要影响系统的 CLI 入口层（`src/index.ts` 或 CLI 路由层）与 Agent 核心控制层（`src/controller/AgentController.ts`）。

### 2.1 会话管理模块 (`SessionManager`)
- **职责**：维护当前交互期间的对话历史（Messages Context）。
- **数据结构**：
  ```typescript
  interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: number;
  }
  ```
- **关键机制**：实现滑动窗口机制。当对话历史累积 Token 数接近模型上下文上限（如 4000 tokens）时，自动裁切最早的历史记录，仅保留最近的 N 轮对话。

### 2.2 CLI 终端交互层 (`InteractiveShell`)
- **职责**：接管终端的 `stdin/stdout`，处理用户的多行输入、解析快捷指令，并渲染动画与流式输出。
- **技术选型推荐**：
  - 基于 Node.js 原生 `readline` 模块封装基础的 REPL。
  - 对于带有 Loading 动画（如转圈）和代码高亮的展现，可引入 `ora` (Loading) 和 `chalk` (终端颜色)。
- **指令拦截器 (Command Interceptor)**：
  - 在将输入送进大模型前，先通过正则解析 `/clear`, `/history`, `/exit` 等 meta command，并由本地代码直接处理。

### 2.3 流式响应对接 (Streaming LLM Adapter)
- **职责**：将现有大模型接口（如 Zhipu GLM 或 OpenAI）的调用从“等待完整返回（Batch）”重构/增加为“受系统支持的事件流处理（Stream）”。
- **机制**：
  - `AgentController` 暴露一个 `askStream(prompt: string, onData: (chunk: string) => void): Promise<void>` 方法。
  - CLI 层传入回调，将接收到的每一个 `chunk` 用 `process.stdout.write(chunk)` 实时打到屏幕上。

## 3. 分阶段实施路径

### 实施阶段一：流式基础互动 (Streaming Foundation)
1. **升级 LLM Adapter**：在底层模型接入层实现流式调用接口。
2. **基础 REPL 环境**：在 `index.ts` 引入交互模式 (`npm start` 默认进入)，渲染基础的 `CodeAgent >` 提示符。
3. **联调验证**：用户输入单行字符，系统端打字机式流式输出回复。

### 实施阶段二：会话状态与记忆 (Session Memory)
1. **开发 `SessionManager` 类**：引入消息历史数组进行对话追踪。
2. **接管 Context Token**：结合现有的 Token 统计核心，实现超过限制时前向裁剪的滑动窗口。
3. **验证多轮对话能力**：测试 Agent 对上文代词（如“那就按这个改吧”）的理解准确性。

### 实施阶段三：用户体验升级 (UX Enhancements)
1. **注入 Meta Commands**：开发拦截器。实现 `/clear` 重置 `SessionManager`，`/exit` 友好退出终端。
2. **美化**：增加 `ora` 库实现思考状态时的 Loading 动画。如果输出中包含 Markdown 代码块（`````），使用高亮引擎着色。
3. **(进阶项) 多行输入兼容**：增加触发机制，如敲击 `\`+Enter 不立即发送而是换行，连续出现空行或者明确的发送指令（Ctrl+D）时再提交流程。

## 4. 依赖项与影响范围
- **新增依赖库**：可能需要安装 `ora` (加载动画)、`chalk` (控制台彩色文本，如果已有则复用)、`marked-terminal` (纯终端 Markdown 渲染, 可选)。
- **安全风险**：目前 F7 主要侧重于纯文字交互。如果下一步开放自动执行系统指令的权限，需要复用现有的 HITL (Human in the loop) 与 `SafetyGuard` 拦截逻辑。
