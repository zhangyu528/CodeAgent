# F17 架构重构：CLI 与 Runtime 分离 (Ports & Adapters)

## 1. 背景与目标 (Context & Objective)

当前项目 `CodeAgent` 是一个典型的 CLI 工具，其核心业务逻辑（Controller, LLM, Tools）与终端交互逻辑（Inquirer, Chalk, Ora）深度耦合。

为了支持 **macOS App**（以及未来可能的 VSCode 插件、Web 界面）作为前端 UI，我们需要将“核心运行时 (Runtime)”与“用户界面 (UI)”彻底分离。

**目标**：
1.  **解耦 (Decoupling)**: 核心逻辑不依赖任何 UI 库（如 `inquirer`, `ora`, `chalk`）。
2.  **多端支持 (Multi-Head)**: 同时支持 **CLI App**（面向人类，TTY 交互）和 **Bridge App**（面向机器，JSON-RPC 交互）。
3.  **稳定性 (Stability)**: Bridge 模式下，STDOUT 仅输出严格的 JSON 协议，杜绝日志污染。

## 2. 核心架构：六边形架构 (Hexagonal Architecture)

我们将采用 **Ports and Adapters** 模式进行重构。

```mermaid
graph TD
    subgraph "Core (Domain Logic)"
        Controller[Agent Controller]
        LLM[LLM Engine]
        Tools[Tools Registry]
        Memory[Memory Manager]
        IUI[Interface: IUIAdapter]
    end

    subgraph "Adapters (Infrastructure)"
        CLI_Adapter[CLI Adapter (TTY)]
        IPC_Adapter[IPC Adapter (JSON-RPC)]
    end

    subgraph "Apps (Entry Points)"
        BinCLI[bin/codeagent] --> CLI_Adapter
        BinBridge[bin/codeagent-bridge] --> IPC_Adapter
    end

    CLI_Adapter -->|Implements| IUI
    IPC_Adapter -->|Implements| IUI
    Controller -->|Uses| IUI
```

### 2.1 目录结构重构

```text
src/
├── core/              <-- 【纯净核心】业务逻辑，无 UI 依赖
│   ├── controller/    (AgentController, ContextInformer)
│   ├── llm/           (Engine, Providers)
│   ├── tools/         (Core Tools Implementation)
│   └── interfaces/    (IUIAdapter 定义)
│
├── apps/              <-- 【应用入口】组装 Core 和 Adapter
│   ├── cli/           <-- 现在的 CLI 实现
│   │   ├── index.ts   (CLI main)
│   │   ├── components/(HUD, Bubbles, Renderer)
│   │   └── adapter.ts (TTY_UIAdapter)
│   │
│   └── bridge/        <-- 【macOS App 专用】
│       ├── index.ts   (Bridge main)
│       ├── protocol.ts(JSON-RPC Types)
│       └── adapter.ts (IPC_UIAdapter)
│
└── utils/             (Logger, Helpers)
```

## 3. 核心抽象：UIAdapter 接口

这是 Core 与外界通信的唯一契约。

```typescript
// src/core/interfaces/ui.ts

export interface IUIAdapter {
  // --- 输出 (One-way) ---
  // 思考过程 (增量)
  onThink(text: string): void;
  // 响应内容 (增量)
  onStream(token: string): void;
  // 工具执行状态
  onToolStart(name: string, input: any): void;
  onToolEnd(name: string, output: any): void;
  // 状态变更 (如 Model 切换)
  onStatusUpdate(status: any): void;

  // --- 交互 (Request-Response) ---
  // 核心请求用户输入/确认，返回 Promise 等待结果
  ask(question: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  select(message: string, choices: string[]): Promise<string>;
}
```

## 4. 通信协议：JSON-RPC 2.0 (Bridge Mode)

**传输层**: Standard I/O (stdio)
**格式**: JSON Lines (每行一个完整的 JSON 对象)

### 4.1 macOS -> Core (Request)
```json
{ "jsonrpc": "2.0", "method": "chat.start", "params": { "message": "你好" }, "id": 1 }
```

### 4.2 Core -> macOS (Notification / Response)
```json
// 流式输出 (Notification)
{ "jsonrpc": "2.0", "method": "stream.chunk", "params": { "token": "好" } }

// 请求交互 (Request, 反向调用)
{ "jsonrpc": "2.0", "method": "ui.confirm", "params": { "msg": "删除文件?" }, "id": 100 }
```

### 4.3 macOS -> Core (Response to UI Request)
```json
// 响应上面的 ui.confirm
{ "jsonrpc": "2.0", "result": true, "id": 100 }
```

## 5. 实施路线图 (Implementation Roadmap)

### Phase 1: 接口抽象与提取 (Refactor)
1.  **定义接口**: 创建 `src/core/interfaces/ui.ts`。
2.  **提取 Core**: 将 `src/controller` 和 `src/llm` 中的 `console.log` 和 UI 依赖清理干净，全部通过 `IUIAdapter` 调用。
3.  **适配 CLI**: 将现有的 `DefaultUIAdapter` (基于 Inquirer) 改造为实现 `IUIAdapter` 接口。
4.  **验证**: 确保 CLI 功能与重构前完全一致。

### Phase 2: Bridge 应用实现 (New Feature)
1.  **实现 IPC Adapter**: 创建 `src/apps/bridge/adapter.ts`，实现 `IUIAdapter`。
    *   将 `onStream` 等调用转换为 `stdout.write(JSON)`。
    *   将 `confirm` 等调用转换为发送 JSON 请求并挂起 Promise。
2.  **创建 Bridge 入口**: `src/apps/bridge/index.ts`。
    *   **劫持 console**: 强制重定向 `console.log` 到 `stderr`，确保 `stdout` 纯净。
    *   **监听 STDIN**: 解析 JSON-RPC 请求并调用 Controller。
3.  **注册 Bin**: 在 `package.json` 增加 `bin/codeagent-bridge`。

### Phase 3: 集成与测试 (Integration)
1.  **E2E 测试脚本**: 编写一个 Node.js 脚本模拟 macOS App，通过 `spawn` 启动 Bridge，发送 JSON 并验证响应。
2.  **macOS App 对接**: 交付 Bridge 二进制给 macOS 开发端。

## 6. 关键注意事项

*   **Stdout 洁癖**: 在 Bridge 模式下，任何非 JSON 的输出到 stdout 都会导致通信失败。必须在入口处全局劫持 `console.log`, `console.warn`, `console.error`。
*   **异步 IO**: Node.js 的 `process.stdin` 在数据量大时可能分包，需要处理 Line Buffer (按行缓冲)。
*   **错误处理**: JSON 解析失败不能 crash，应返回标准 JSON-RPC Error。
