# @mariozechner/pi-coding-agent 迁移方案

## 1. 背景与动机

CodeAgent 最初基于 `@mariozechner/pi-agent-core` 构建，这是一个通用的 Agent 运行时框架。随着项目演进，我们需要更专业的编码助手能力（如支持 diff 的文件编辑、分页读取、更复杂的会话管理等）。

`@mariozechner/pi-coding-agent` 是基于 `pi-agent-core` 构建的专用 SDK，它内置了针对软件工程场景优化的工具集和 `AgentSession` 抽象。

## 2. 迁移收益

- **工具优化**：直接使用经过优化的内置工具（`read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`），取代了手写的工具实现。
- **功能增强**：`edit` 工具支持精确的字符串替换和 diff 逻辑，`read` 工具支持分页读取，避免了上下文溢出。
- **架构简化**：通过 `AgentSession` 统一管理会话状态、事件订阅和自动压缩（Compaction），减少了 UI 层的负担。
- **维护成本降低**：删除了 `src/agent/tools/` 下约 500 行自定义代码，由上游 SDK 统一维护核心逻辑。

## 3. 实施细节

### 3.1 核心层重构 (`src/agent/agent.ts`)

- 引入 `ensureAgentInitialized()` 异步初始化方法。
- 使用 `createAgentSession` 替代原有的 `Agent` 实例化逻辑。
- 注入 `codingTools`（read, write, edit, bash）及导航工具（find, grep, ls）。

### 3.2 UI 与 Hook 适配

- **`AgentContext.tsx`**：扩展为提供 `AgentSession` 实例，支持 `useAgentSession()` 钩子。
- **`useAgentEvents.ts`**：改为订阅 `session.subscribe`。由于 `AgentSession` 会内部处理消息持久化和 Token 统计，UI 层逻辑更加聚焦于渲染。
- **`ChatPage.tsx`**：适配新的上下文结构，确保消息流正确恢复和显示。

### 3.3 工具清理

- 删除了以下冗余文件：
  - `src/agent/tools/read_file.ts`
  - `src/agent/tools/write_file.ts`
  - `src/agent/tools/run_command.ts`
  - `src/agent/tools/list_directory.ts`
  - `src/agent/tools/search_files.ts`
  - `src/agent/tools/registry.ts`

## 4. 依赖冲突解决记录

### 冲突现象

在安装 `@mariozechner/pi-coding-agent` 时出现 `ERESOLVE` 错误，主要源于以下开发依赖的版本不匹配：

- `@eslint/js@10.0.1` 要求 `eslint@^10.0.0`。
- 项目原本安装的是 `eslint@9.39.4`。

### 解决方案

将项目中的 ESLint 引擎统一升级到 **10.x** 版本：

1. 更新 `package.json`：将 `"eslint": "9"` 改为 `"eslint": "^10.0.1"`。
2. 运行 `npm install`。
3. 此举消除了 `peerDependency` 冲突，使项目不再需要 `--legacy-peer-deps` 即可正常安装依赖。

## 5. 验证说明

- **API 契约测试**：已更新并运行 `tests/unit/agent/piAgentCoreContract.test.ts`，所有 8 项测试通过。
- **会话回归测试**：运行 `tests/unit/agent/sessions.test.ts`，49 项测试全部通过。
- **手动验证**：在 TUI 中验证了“读取文件 -> 思考 -> 修改代码 -> 运行命令”的完整循环。
