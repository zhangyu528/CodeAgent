# F17 架构重构：CLI 与 Runtime 分离 (Ports & Adapters)

## 1. 背景与目标 (Context & Objective)

当前项目 `CodeAgent` 是 CLI 工具。为了支持桌面端/桥接端并保持会话一致性，需要将“核心运行时 (Runtime)”与“用户界面 (UI)”彻底分离。

**目标**：
1. 核心逻辑不依赖 UI 库。
2. 多端共享同一套 runtime 语义。
3. Bridge 模式 stdout 仅输出 JSON 协议。
4. Session 持久化职责归 runtime，不归前端 UI。

## 2. 核心架构：六边形架构 (Hexagonal Architecture)

```mermaid
graph TD
    subgraph "Core (Domain Logic)"
        Controller[Agent Controller]
        Session[Session Service + Repository]
        LLM[LLM Engine]
        Tools[Tools Registry]
        Memory[Memory Manager]
        IUI[Interface: IUIAdapter]
    end

    subgraph "Adapters (Infrastructure)"
        CLI_Adapter[CLI Adapter (TTY)]
        IPC_Adapter[IPC Adapter (JSON-RPC)]
        SqliteRepo[SQLite Repository]
    end

    subgraph "Apps (Entry Points)"
        BinCLI[bin/codeagent] --> CLI_Adapter
        BinBridge[bin/codeagent-bridge] --> IPC_Adapter
    end

    CLI_Adapter -->|Implements| IUI
    IPC_Adapter -->|Implements| IUI
    Controller -->|Uses| IUI
    Controller -->|Uses| Session
    Session -->|Implemented by| SqliteRepo
```

## 3. 会话职责边界（已落地）

- Runtime 管理 session 生命周期：创建、续接、结束、中断标记。
- Runtime 负责消息持久化和读取（SQLite）。
- CLI/Bridge 仅调用 runtime API 并渲染数据，不直接写 session 存储。
- `MemoryManager` 继续负责 token 滑窗，session 历史作为其输入来源。

## 4. 通信协议：JSON-RPC 2.0 (Bridge Mode)

**传输层**: stdio  
**格式**: JSON Lines

### 4.1 常用请求（App -> Runtime）
```json
{ "jsonrpc": "2.0", "method": "chat.stream", "params": { "prompt": "你好", "sessionId": "optional" }, "id": 1 }
{ "jsonrpc": "2.0", "method": "session.start", "params": { "initialPrompt": "帮我修复测试" }, "id": 2 }
{ "jsonrpc": "2.0", "method": "session.listRecent", "params": { "limit": 10 }, "id": 3 }
{ "jsonrpc": "2.0", "method": "session.resume", "params": { "sessionId": "..." }, "id": 4 }
{ "jsonrpc": "2.0", "method": "session.end", "params": { "sessionId": "..." }, "id": 5 }
```

### 4.2 常用通知（Runtime -> App）
```json
{ "jsonrpc": "2.0", "method": "stream.chunk", "params": { "token": "好" } }
{ "jsonrpc": "2.0", "method": "tool.start", "params": { "name": "read_file", "input": {} } }
{ "jsonrpc": "2.0", "method": "tool.end", "params": { "name": "read_file", "output": "..." } }
```

## 5. 存储策略

- 默认路径：`~/.codeagent/sessions.db`
- 可通过 `CODEAGENT_SESSION_DB` 覆盖
- 实现优先 `bun:sqlite`，不可用时回退 `node:sqlite`
- 建议启用 `WAL` 以提升交互读写体验