# SPEC: Tool Execution Sandbox

## Objective

CodeAgent 的工具执行层存在架构缺陷：安全检查分散在各个工具中（`run_command.ts` 路径验证、`write_file.ts` 路径验证、`search_files.ts` 深度检查），缺乏统一的 sandboxing API。

**目标**：构建 `ToolExecutionContext` 统一 sandboxing 类，所有工具通过统一 API 执行，实现：

1. 路径验证集中化（workspace root 边界防护）
2. 命令执行统一化（shell 隔离、超时、资源限制）
3. 权限分级透明化（safe / elevated / dangerous 三级）

## Tech Stack

- **语言**：TypeScript
- **运行时**：Bun（Node.js 兼容）
- **依赖**：无新增外部依赖，使用 `child_process` + 内置 `fs`/`path`
- **关键模块**：`src/agent/tools/sandbox/`

## Commands

```bash
Build:  bun run build
Test:   bun run test:run
Dev:    bun run dev
Lint:   bun run lint
```

## Project Structure

```
src/agent/tools/
├── sandbox/
│   ├── index.ts              ← 统一导出
│   ├── context.ts            ← ToolExecutionContext 类（新建）
│   ├── workspace.ts           ← 已有：workspace root + 路径验证
│   ├── permission-ledger.ts  ← 已有：session 级权限分类账
│   └── command-tiers.ts      ← 已有：命令分级
├── security-patterns.ts       ← 已有：BLOCKED_REGEX, validatePath, ALLOWED_COMMANDS
├── run_command.ts             ← 修改：委托 sandbox.exec()
├── write_file.ts             ← 修改：使用 sandbox context
├── search_files.ts           ← 修改：使用 sandbox context
└── read_file.ts              ← 修改：使用 sandbox context
```

## Code Style

### ToolExecutionContext API

```typescript
class ToolExecutionContext {
  constructor(options: SandboxOptions);

  // 文件操作
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;

  // 命令执行
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;

  // 安全验证
  validatePath(path: string): string | null;
  isCommandAllowed(command: string): CommandCheckResult;
}
```

### 命名规范

- 类名：`PascalCase`（如 `ToolExecutionContext`）
- 方法名：`camelCase`（如 `validatePath`）
- 常量：`UPPER_SNAKE_CASE`（如 `MAX_BUFFER_SIZE`）
- 接口：`PascalCase`（如 `ExecResult`）

### 错误处理模式

```typescript
// 所有工具错误返回统一格式
function toolError(message: string, reason: string): AgentToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    details: { success: false, reason },
  };
}
```

## Testing Strategy

- **框架**：Vitest（项目已有 `bun run test:run`）
- **位置**：`src/agent/tools/sandbox/*.test.ts`（新建）
- **覆盖目标**：ToolExecutionContext 所有公开方法 + 边界条件
- **测试模式**：
  - 单元测试：context.validatePath(), context.isCommandAllowed()
  - 集成测试：context.exec() 实际子进程执行

## Boundaries

### Always

- 所有文件操作必须通过 `context.validatePath()` 验证
- 所有命令执行必须通过 `context.exec()` 路由
- 危险命令（BLOCKED_REGEX）永远拒绝，无例外
- 错误必须返回 `AgentToolResult` 结构

### Ask first

- 添加新命令到 ALLOWED_COMMANDS（需要安全评估）
- 修改 sandbox 默认选项

### Never

- 不能绕过 sandbox 直接调用 `exec()` / `execFile()`
- 不能在 sandbox 外存储 workspace root 路径
- 不能接受外部路径输入而不验证

## Success Criteria

1. [ ] `ToolExecutionContext` 类创建完成，暴露 `exec()`, `validatePath()`, `readFile()`, `writeFile()` API
2. [ ] `run_command.ts` 清理 merge conflict 标记，委托 `sandbox.exec()`
3. [ ] `write_file.ts` 使用 `sandbox.validatePath()` 替代内联实现
4. [ ] `search_files.ts` 使用 `sandbox.validatePath()` 替代内联实现
5. [ ] `read_file.ts` 新增 workspace root 验证（使用 `sandbox.validatePath()`）
6. [ ] 所有工具通过 `sandbox/index.ts` 统一导出
7. [ ] 新增 `context.test.ts` 覆盖 ToolExecutionContext 核心方法
8. [ ] `bun run test:run` 全部通过

## Open Questions

1. `permission-ledger` 是否应该在 session 结束时通过 agent 生命周期钩子清空？
2. sandbox 选项（maxBuffer, timeout）是否应该通过环境变量可配置？
3. `ToolExecutionContext` 应该是单例还是 per-session 实例？
