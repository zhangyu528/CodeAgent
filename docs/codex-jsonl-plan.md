# SwiftUI ↔ Node 本地 stdio JSON‑RPC 通信验证（Codex 风格 JSONL）

## Summary
构建一个最小可运行的 SwiftUI 客户端与 Node agent 进程，通过 stdio + JSONL（逐行 JSON）进行双向通信。协议层采用 JSON‑RPC lite（请求/响应/通知结构，但可不包含 `jsonrpc: "2.0"`）。实现基础请求/响应与通知，覆盖进程生命周期、错误处理与日志，提供端到端验证流程与测试场景。

## Implementation Changes
1. 协议与消息模型
- 采用 JSON‑RPC lite 结构：`id`, `method`, `params`, `result`, `error`。
- 传输分帧采用 JSONL：每条消息为单行 JSON，以 `\n` 作为分隔。
- v1 支持请求/响应与通知，不做流式输出与取消。

2. 进程与通信拓扑
- SwiftUI 应用负责启动 Node 子进程。
- SwiftUI 通过 stdio 与 Node 双向通信，读写分离，避免阻塞 UI 线程。
- 进程退出路径：发送 `shutdown` 请求 → 等待响应 → 发送 `exit` 通知 → 终止子进程。

3. 最小 RPC 方法集
- `initialize`：握手，返回能力声明与版本。
- `shutdown` + `exit`：标准关闭序列。
- 自定义方法：
- `agent/ping`：请求/响应验证通路。
- `agent/echo`：验证参数传递与结果回传。
- `agent/notify`：Node 发送通知，SwiftUI 仅消费不响应。

4. SwiftUI 侧实现要点
- 进程启动与生命周期管理模块。
- stdio 读写管道与 JSONL 解码器（按 `\n` 切分消息）。
- JSON‑RPC 调度器：请求映射、响应匹配、通知分发。
- UI 层仅绑定状态，不直接处理 IO；IO 走后台队列。
- 处理“半包/粘包”情况：缓冲区累积直到遇到 `\n` 才解析。

5. Node 侧实现要点
- stdio JSONL 解码器与编码器（每条消息一行）。
- JSON‑RPC 路由表与处理器。
- 统一错误处理：`error.code`, `error.message`, `error.data`。
- 调试日志输出到 `stderr`，避免污染 RPC `stdout`。

## Isolation Requirement
- 所有测试程序与相关文件仅放在：`/Users/eric/Documents/CodeAgent/sandbox/codex-jsonl-poc`。
- 不修改 `/Users/eric/Documents/CodeAgent/src` 及其子目录。

## Test Plan
1. 协议级测试
- 连续发送多条 JSONL 消息，SwiftUI 正确拆分并解析。
- 处理粘包/半包：分段输入仍能正确拼接成完整 JSON。

2. 功能级测试
- `initialize` → `agent/ping` → `agent/echo` 的完整流程。
- Node 主动发通知，SwiftUI 能正确接收并更新 UI 状态。

3. 生命周期测试
- 正常关闭：`shutdown` → `exit` 后子进程退出。
- 异常关闭：Node 崩溃/kill 后 SwiftUI 能检测并显示错误状态。

## Assumptions
- 传输采用 JSONL（逐行 JSON）。
- 采用 JSON‑RPC lite（可不包含 `jsonrpc: "2.0"` 字段）。
- v1 只实现基础 RPC，不包含流式结果与取消。
- SwiftUI 负责启动 Node agent 子进程并管理生命周期。
