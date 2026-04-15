# 任务拆分：CLI JSON Output Mode

## 关联 SPEC
- **规格文档**：docs/ideas/todo/cli-json-output-mode-spec.md

## Idea 信息
- **文件**：docs/ideas/todo/cli-json-output-mode.md
- **Problem Statement**：CodeAgent CLI 需要支持非交互式 JSON 输出，用于脚本化管道、CI/CD 集成和程序化调用
- **MVP Scope**：
  1. 添加 `--json` flag 到 CLI 入口点
  2. JSON 模式：绕过 Ink TUI 渲染，输出 NDJSON 到 stdout
  3. 工具调用和结果序列化为 JSON（带 `type` 区分字段）
  4. Agent 响应序列化为 `{"type":"response",...}`
  5. 错误序列化为 `{"type":"error","code":"...","message":"..."}`
  6. Stdin 保持活跃以支持多轮会话

## 任务列表

### Task 1: Flag Parsing 基础设施

**验收标准**：
- [ ] `parseFlags(['--json', '--prompt', 'hello', '--session', 'test'])` 返回 `{json: true, prompt: 'hello', session: 'test'}`
- [ ] 未知 flag 被忽略（`--unknown` 不报错）
- [ ] 无 flag 时返回 `{json: false}`
- [ ] `--prompt` 缺少值时返回 `undefined`

**TDD 步骤**：
- RED：写 `parseFlags` 测试，验证 flag 解析逻辑
- GREEN：实现最小化 `parseFlags` 函数
- REFACTOR：提取类型定义

**文件**：
- `src/apps/cli/json/flags.ts`（新建）

**Estimated scope**: XS（1-2 文件）

---

### Task 2: NDJSON Emitter 实现

**验收标准**：
- [ ] `emit({type: 'response', content: 'hello', model: 'test'})` 输出 `{"type":"response","content":"hello","model":"test"}\n`
- [ ] 每次 `emit` 调用输出独立一行
- [ ] `emit` 在非 JSON 模式下不输出任何内容（静默）
- [ ] 大型字符串正确序列化（不截断）

**TDD 步骤**：
- RED：写 `emit` 测试，验证 NDJSON 输出格式
- GREEN：实现 `emit` 函数，写入 `process.stdout`
- REFACTOR：添加 `isJsonMode` 状态管理

**文件**：
- `src/apps/cli/json/emitter.ts`（新建）

**Estimated scope**: XS（1-2 文件）

---

### Task 3: JSON Event Types 定义

**验收标准**：
- [ ] `JsonEvent` 类型包含所有 4 种事件变体（response, tool_call, tool_result, error）
- [ ] `ToolResultData` 正确处理大字符串
- [ ] `ErrorData` 包含 `code` 和 `message` 字段
- [ ] TypeScript 编译无错误

**TDD 步骤**：
- RED：写类型检查测试
- GREEN：定义完整的 `JsonEvent` 类型联合
- REFACTOR：添加 Zod schema 验证（如需要）

**文件**：
- `src/apps/cli/json/types.ts`（新建）

**Estimated scope**: XS（1 文件）

---

### Task 4: CLI 入口点分支逻辑

**验收标准**：
- [ ] `codeagent --json` 跳过 Ink TUI 渲染
- [ ] `codeagent --json --prompt "hello"` 输出 JSON 到 stdout
- [ ] `codeagent --json --session myname --prompt "hello"` 使用指定 session
- [ ] 无 `--json` 时行为不变（TUI 模式）
- [ ] TTY 检查在 JSON 模式下被跳过（允许 headless 运行）

**TDD 步骤**：
- RED：写 CLI 分支逻辑的集成测试
- GREEN：修改 `src/apps/cli/index.tsx`，添加 flag 检测和分支
- REFACTOR：将 JSON 模式逻辑提取到独立模块

**文件**：
- `src/apps/cli/index.tsx`（修改）

**Estimated scope**: S（1-2 文件）

---

### Task 5: Agent 事件到 JSON 序列化的连接

**验收标准**：
- [ ] Agent `response` 事件输出 `{"type":"response",...}` NDJSON 行
- [ ] Agent `tool_call` 事件输出 `{"type":"tool_call",...}` NDJSON 行
- [ ] Agent `tool_result` 事件输出 `{"type":"tool_result",...}` NDJSON 行
- [ ] 事件顺序正确：response → tool_call → tool_result → response → ...

**TDD 步骤**：
- RED：写事件序列化的集成测试
- GREEN：实现 `src/apps/cli/json/JsonMode.ts`，连接 agent 事件到 `emit`
- REFACTOR：抽取通用的 `EventSerializer` 类

**文件**：
- `src/apps/cli/json/JsonMode.ts`（新建）

**Estimated scope**: M（2-3 文件）

---

### Task 6: 错误处理与边界情况

**验收标准**：
- [ ] API 错误（AUTH_FAILED 等）序列化为 `{"type":"error","code":"AUTH_FAILED","message":"..."}`
- [ ] 工具执行失败序列化为错误事件
- [ ] 未知错误类型使用 `code: "UNKNOWN_ERROR"`
- [ ] JSON 模式下的致命错误仍输出 JSON 到 stdout，然后 exit(1)

**TDD 步骤**：
- RED：写错误处理的测试用例
- GREEN：实现错误序列化逻辑
- REFACTOR：统一错误代码常量

**文件**：
- `src/apps/cli/json/errors.ts`（新建）

**Estimated scope**: S（1-2 文件）

---

### Task 7: 测试套件与构建验证

**验收标准**：
- [ ] `npm run test:run` 所有测试通过
- [ ] `npm run build` 构建成功
- [ ] `codeagent --json --prompt "hello" 2>/dev/null | jq -r '.type'` 输出 `response`
- [ ] JSON 输出行是有效的 NDJSON（每行可独立 `JSON.parse`）

**TDD 步骤**：
- RED：写端到端测试验证完整流程
- GREEN：运行测试，修复任何失败
- REFACTOR：添加 CI 友好的测试输出

**文件**：
- `tests/unit/json-mode/` 目录（新建）

**Estimated scope**: S（2-3 文件）

---

## 任务执行顺序

1. **Task 1** → **Task 2** → **Task 3**（基础设施，可并行准备但按顺序实现）
2. **Task 4** → **Task 5** → **Task 6**（核心功能实现）
3. **Task 7** → **Checkpoint: All tests pass, build succeeds**

---

## Checkpoint

- [ ] Task 1-3 完成：flag parsing、emitter、types
- [ ] Task 4-6 完成：CLI 分支、事件连接、错误处理
- [ ] Task 7 完成：所有测试通过，构建成功
- [ ] 端到端验证：`codeagent --json --prompt "hello"` 输出有效 NDJSON
