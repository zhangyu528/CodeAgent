# SPEC: CLI JSON Output Mode

## ASSUMPTIONS I'M MAKING

1. CLI 入口点是 `src/apps/cli/index.tsx`（通过 `bin/codeagent.js` 调用 `dist/apps/cli/index.js`）
2. `--json` flag 在入口点检测，用于决定是否跳过 Ink TUI 渲染
3. Agent 的核心交互在 `src/agent/` 中，通过 `getAgent()` 访问
4. 工具调用通过 `agent.run()` 触发，回调通过事件订阅
5. NDJSON 输出意味着每行一个 JSON 对象，用 `\n` 分隔
6. 当前 CLI 不支持任何 flag parsing（直接 bootstrap），需要引入 minimal flag parsing
7. 使用 `--` 风格的 flag（如 `--json`），不使用 subcommand
8. CI 场景以单次请求响应为主，多轮会话通过 stdin 实现

→ 如果以上假设有误，请指出，我将修正。

---

## Objective

为 CodeAgent CLI 添加 `--json` 非交互模式，使输出可用于脚本化管道、CI/CD 集成和程序化调用。

**用户故事**：

- 作为 CI 系统，我希望能够调用 `codeagent --json --prompt "fix bug"` 并解析结构化输出
- 作为脚本作者，我希望能够 `codeagent --json --session mysession --prompt "..." | jq '.tool_calls'`
- 作为 DevOps 工程师，我希望在 headless 环境中使用 CodeAgent 而无需 TTY

**MVP Success Criteria**：

1. `codeagent --json --prompt "hello"` 输出 NDJSON 到 stdout
2. 每个输出行是有效的 JSON with `type` 字段
3. 响应、工具调用、工具结果、错误都有各自的 JSON 格式
4. stdin 支持多轮对话（与 TUI 模式一致）

---

## Tech Stack

- **Runtime**: Bun >= 1.3.0
- **Framework**: React 19, Ink 6.8.0 (TUI)
- **Agent Core**: `@mariozechner/pi-agent-core` ^0.61.1
- **CLI Entry**: `src/apps/cli/index.tsx`
- **Agent Entry**: `src/agent/agent.ts`
- **Flag Parsing**: Minimal custom implementation (无需额外依赖)
- **测试**: Vitest 4.1.2

---

## Commands

```bash
# 构建
npm run build

# 测试
npm run test:run

# 开发
npm run dev

# 构建后本地测试 JSON 模式
./dist/apps/cli/index.js --json --prompt "say hello"
```

---

## Project Structure

```
src/apps/cli/
├── index.tsx              # CLI 入口，flag 检测，TUI vs JSON 模式分支
├── ink/                   # TUI 渲染（JSON 模式跳过）
│   ├── App.tsx
│   └── ...
└── json/                  # [NEW] JSON 模式处理
    └── JsonMode.ts        # NDJSON 输出处理器

src/agent/
├── agent.ts               # Agent 核心，事件发射
└── ...

tests/
└── unit/
    └── json-mode/         # [NEW] JSON 模式测试
        └── json-output.test.ts
```

---

## Code Style

### Flag Parsing

```typescript
// 最小化 flag parsing（无额外依赖）
function parseFlags(argv: string[]): { json: boolean; prompt?: string; session?: string } {
  const flags: any = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--prompt' && argv[i + 1]) flags.prompt = argv[++i];
    else if (arg === '--session' && argv[i + 1]) flags.session = argv[++i];
  }
  return flags;
}
```

### NDJSON Output

```typescript
// 每个输出对象一行，用 \n 分隔
function emit(event: JsonEvent) {
  process.stdout.write(JSON.stringify(event) + '\n');
}

type JsonEvent =
  | { type: 'response'; content: string; model: string }
  | { type: 'tool_call'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: string; success: boolean }
  | { type: 'error'; code: string; message: string };
```

### Error Format

```typescript
{ type: 'error', code: 'AUTH_FAILED', message: '...' }
// code 使用大写下划线格式
```

---

## Testing Strategy

- **Framework**: Vitest
- **测试位置**: `tests/unit/json-mode/`
- **覆盖率目标**: 核心路径（flag 检测、JSON 序列化、事件路由）

### 测试用例

1. `parseFlags` 正确识别 `--json`、`--prompt`、`--session`
2. `emit` 输出有效的 NDJSON 行
3. JSON 模式下 `agent` 事件正确序列化
4. 错误事件包含 `code` 和 `message` 字段

---

## Boundaries

- **Always**:
  - 所有 JSON 输出到 stdout（不污染 stderr）
  - 每个 NDJSON 行是独立的有效 JSON
  - CI 友好的退出码（0 成功，1 错误）
  - 保留 stdin 支持多轮对话

- **Ask first**:
  - 添加新的 `--flag`（可能影响 UX）
  - 修改 JSON schema（影响下游消费者）
  - 添加 `--output-format` 多格式支持

- **Never**:
  - 在 JSON 模式下输出 TUI 渲染
  - 在 JSON 模式输出中包含 ANSI 转义序列
  - 使用 console.log（用 emit 代替）

---

## Success Criteria

- [ ] `codeagent --json --prompt "hello"` 输出包含 `{"type":"response",...}` 的 NDJSON
- [ ] 工具调用序列化为 `{"type":"tool_call",...}` 并在 tool_result 之前
- [ ] 错误序列化为 `{"type":"error","code":"...","message":"..."}`
- [ ] `npm run test:run` 通过所有测试
- [ ] `npm run build` 成功构建
- [ ] JSON 模式不影响 TUI 模式的代码（分支独立）

---

## Open Questions

1. **多轮会话 stdin**：第一行 prompt 通过 `--prompt` 传入，后续通过 stdin 读取，如何标识结束？（EOF 表示会话结束）
2. **Token 统计**：是否需要在 response 中包含 token 计数？（提案中有，MVP 是否必需？）
3. **工具结果截断**：大型工具结果（如大文件读取）是否需要截断？截断阈值是多少？
4. **日志文件**：是否需要同时写一份人类可读的日志？（提案中 Open Question）
5. **Session 持久化**：CI 场景是否需要 `--session` 参数？（MVP 暂不支持，通过 stdin 模拟）
