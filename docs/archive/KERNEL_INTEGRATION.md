# CodeAgent Kernel 集成指南

本文档旨在指导 macOS/Windows App 开发者如何集成和调用 CodeAgent Kernel 二进制文件。

## 1. 运行环境与启动

Kernel 是一个独立的二进制可执行文件，通过 `npm run pkg` 产出。它不依赖目标机器安装 Node.js 环境。

### 启动方式
App 应当以子进程（Subprocess）的方式启动 Kernel，并建立 **STDIN** 和 **STDOUT** 的管道连接。

*   **macOS**: 调用 `binaries/codeagent-kernel-macos`
*   **Windows**: 调用 `binaries/codeagent-kernel-win.exe`

### 重要日志
*   所有的 **正式通信数据** 均通过 `STDOUT` 输出，且格式为严格的 JSON。
*   所有的 **调试/运行日志** 均重定向到了 `STDERR`。App 开发者可以捕获 `STDERR` 用于排查集成问题。

---

## 2. 通信协议规范

通信采用 **JSON-RPC 2.0** 标准，传输层为 **JSON Lines**（即每一行是一个完整的 JSON 对象，以 `\n` 分隔）。

### 建立连接
当 Kernel 准备就绪时，会主动向 STDOUT 发送一条通知：
```json
{ "jsonrpc": "2.0", "method": "kernel.ready", "params": { "version": "1.0.0" } }
```
收到此消息后，App 方可开始发送请求。

---

## 3. App -> Kernel (请求)

### 3.1 `status`: 获取当前内核状态
获取当前正在使用的 Provider、Model 以及工作区路径。
*   **Request**:
    ```json
    { "jsonrpc": "2.0", "method": "status", "id": 1 }
    ```
*   **Response**:
    ```json
    { "jsonrpc": "2.0", "result": { "provider": "deepseek", "model": "deepseek-chat", "workspace": "/users/path/..." }, "id": 1 }
    ```

### 3.2 `chat.stream`: 开始流式对话
启动一个对话任务，响应内容将通过通知（Notification）实时流式回传。
*   **Request**:
    ```json
    { "jsonrpc": "2.0", "method": "chat.stream", "params": { "prompt": "你好，帮我写个脚本" }, "id": 2 }
    ```
*   **Response**: 立即返回 `{ "jsonrpc": "2.0", "result": { "ok": true }, "id": 2 }` 表示任务已接纳。

---

## 4. Kernel -> App (通知与流式数据)

在执行 `chat.stream` 期间，Kernel 会不断向 STDOUT 推送以下通知。

### 4.1 `stream.chunk`: 文本增量
```json
{ "jsonrpc": "2.0", "method": "stream.chunk", "params": { "token": "好的" } }
```

### 4.2 `think`: 思考过程描述
```json
{ "jsonrpc": "2.0", "method": "think", "params": { "text": "正在分析文件结构..." } }
```

### 4.3 `tool.start`: 工具调用开始
```json
{ "jsonrpc": "2.0", "method": "tool.start", "params": { "name": "read_file", "input": { "filePath": "src/index.ts" } } }
```

### 4.4 `status.update`: 任务完成或状态变化
当收到 `type: "final_answer"` 时，表示本次对话结束。
```json
{ "jsonrpc": "2.0", "method": "status.update", "params": { "type": "final_answer", "content": "..." } }
```

---

## 5. 交互式回调 (反向请求)

当内核执行高风险操作（如写入文件、执行命令）时，会向 App 发送“反向请求”，**App 必须响应** 才能继续。

### 5.1 `ui.confirm`: 安全确认
*   **Kernel Request**:
    ```json
    { "jsonrpc": "2.0", "method": "ui.confirm", "params": { "message": "是否允许写入文件 src/config.ts ?" }, "id": 1001 }
    ```
*   **App Response**:
    ```json
    { "jsonrpc": "2.0", "result": true, "id": 1001 }
    ```

### 5.2 `ui.ask`: 请求文本输入
*   **Kernel Request**:
    ```json
    { "jsonrpc": "2.0", "method": "ui.ask", "params": { "question": "请输入您的 API Key:" }, "id": 1002 }
    ```
*   **App Response**:
    ```json
    { "jsonrpc": "2.0", "result": "sk-xxxxxx", "id": 1002 }
    ```

---

## 6. 最佳实践建议

1.  **行缓冲**: 由于 STDOUT 是流式的，App 侧接收数据时务必使用 `\n` 进行分包缓冲，不要假设一次 `read` 就能读到完整的 JSON。
2.  **错误处理**: 如果收到 `error` 字段的响应，请参考 JSON-RPC 2.0 标准错误码进行处理。
3.  **心跳检测**: 建议通过定期发送 `status` 请求来检测内核子进程是否依然存活。
