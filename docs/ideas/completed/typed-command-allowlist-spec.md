# SPEC: Typed Command Allowlist for Safe Shell Execution

## Objective

消除 `run_command.ts` 中"未知命令隐式放行"的安全漏洞，并用 Zod schema 对白名单命令进行参数级别校验。目标是建立显式安全边界：只有明确在白名单中且参数通过校验的命令才能执行。

**问题**：当命令不在 `ALLOWED_COMMANDS` 中且没有 shell metacharacters 时，代码会 fallback 到 `exec()` with `shell=true`，造成隐式放行。

**解决**：Unknown commands → `COMMAND_NOT_ALLOWED` 拒绝，替代隐式 fallback。

**用户故事**：
- 作为安全加固，unknown commands 必须被显式拒绝，而不是静默放行
- 作为开发者，我需要为常用命令（如 `git`, `npm`）添加参数校验，防止恶意调用
- 错误信息需要清晰，告知用户如何申请添加新命令

## ASSUMPTIONS I'M MAKING

1. 当前 `ALLOWED_COMMANDS` 是 `Set<string>`，没有参数 schema（已验证）
2. 所有白名单命令的解析都使用 `parseCommand()` 拆分 base cmd + args（已验证）
3. `pi-agent-core` 的 `AgentToolResult` 可以携带任意 `details` 字段（已验证）
4. 项目使用 Zod 4（已在 `compatibilityCheck.ts` 中确认 `z.object()` API）
5. 测试框架是 Vitest（`run_command.test.ts` 已使用 `describe/it/expect`）

## Tech Stack

- **语言**：TypeScript
- **运行时**：Bun (Node.js 兼容)
- **依赖**：`@mariozechner/pi-agent-core`, `zod ^4.3.6`
- **测试框架**：Vitest
- **构建**：Bun build

## Project Structure

```
src/agent/tools/
├── run_command.ts           # 命令执行工具（含新增的参数校验逻辑）
├── run_command.test.ts     # 单元测试
├── security-patterns.ts    # 安全模式定义（COMMAND_ALLOWLIST 新增位置）
└── security.ts            # 安全验证函数（re-export backward compat）
```

## Commands

```bash
# 运行测试
bun run test:run src/agent/tools/run_command.test.ts

# 类型检查
bun tsc --noEmit
```

## Code Style

### COMMAND_ALLOWLIST 结构

```typescript
import { z } from 'zod';

// 每个命令的参数 schema
const CommandSchemas = {
  git: z.object({
    cmd: z.enum(['status', 'log', 'diff', 'add', 'commit', 'push', 'pull', 'branch', 'checkout', 'fetch', 'clone']),
    cwd: z.string().optional(),
  }),
  npm: z.object({
    command: z.enum(['install', 'run', 'test', 'build', 'start', 'dev', 'pack', 'publish']),
    args: z.string().optional(),
  }),
  bun: z.object({
    command: z.enum(['install', 'run', 'test', 'build', 'add', 'remove']),
    script: z.string().optional(),
  }),
} as const;

// Type-safe command argument type
type CommandArgs<T extends keyof typeof CommandSchemas> = z.infer<typeof CommandSchemas[T]>;

// Fallback: no schema = accept any args (legacy behavior for simple commands)
const NoSchema = null;

// Union type for all allowed commands with their schemas
type AllowedCommand =
  | { name: 'git'; schema: typeof CommandSchemas.git }
  | { name: 'npm'; schema: typeof CommandSchemas.npm }
  | { name: 'bun'; schema: typeof CommandSchemas.bun }
  | { name: string; schema: null }; // fallback for commands without schema

// COMMAND_ALLOWLIST: Record<command_name, schema | null>
export const COMMAND_ALLOWLIST: Record<string, z.ZodType | null> = {
  git: CommandSchemas.git,
  npm: CommandSchemas.npm,
  bun: CommandSchemas.bun,
  ls: null,      // No schema = any args accepted
  cat: null,
  echo: null,
  // ... 其他命令
};
```

### Decision Tree（执行流程）

```
execute(command: string)
  1. isCommandBlocked(command)?
     → YES: reject('blocked_dangerous_pattern')
  2. hasShellMetacharacters(command)?
     → YES: exec() with shell=true  [保留现有行为]
  3. baseCmd ∈ COMMAND_ALLOWLIST?
     → NO:  reject('command_not_allowed')
  4. schema = COMMAND_ALLOWLIST[baseCmd]
     → schema !== null: safeParse(args) 失败 → reject('invalid_arguments')
     → schema === null: execFile() 直接执行
  5. execFile(cmd, args)
```

### 错误信息规范

```typescript
// 新增 reason
type RejectionReason =
  | 'blocked_dangerous_pattern'  // 已存在
  | 'command_not_allowed'         // 已存在（替换隐式 fallback）
  | 'invalid_arguments';          // 新增：参数校验失败

// invalid_arguments 错误信息示例
`Invalid arguments for '${baseCmd}': ${error.message}
Usage: ${baseCmd} ${argsHint}
To request changes, open an issue at https://github.com/...`;
```

## Testing Strategy

- **框架**：Vitest（与 `run_command.test.ts` 一致）
- **位置**：`src/agent/tools/run_command.test.ts`
- **覆盖要求**：
  - [ ] 白名单命令 + 合法参数 → 执行成功
  - [ ] 白名单命令 + 非法参数 → `invalid_arguments` 拒绝
  - [ ] 非白名单命令 → `command_not_allowed` 拒绝
  - [ ] `COMMAND_ALLOWLIST` 顶层 Record 结构验证

## Boundaries

- **Always**：
  - 所有命令参数必须经过 `safeParse()` 校验（如果 schema !== null）
  - `BLOCKED_REGEX` 检查始终优先于白名单
  - 测试通过后才能提交

- **Ask first**：
  - 向 `COMMAND_ALLOWLIST` 添加新命令需要提供 Zod schema
  - 修改现有 schema 需要评审

- **Never**：
  - 不能将非白名单命令 fallback 到 `exec()` — 必须显式拒绝
  - 不能在 schema 为 `null` 时做参数校验（保持向后兼容）
  - 不能修改 `BLOCKED_REGEX` 的正则表达式（安全关键路径）

## Success Criteria

1. [ ] `COMMAND_ALLOWLIST` 已定义，包含 `git`, `npm`, `bun` 的 Zod schema
2. [ ] `run_command.ts` 使用 `safeParse()` 对有 schema 的命令进行参数校验
3. [ ] `git commit -m "test"` → 校验通过（`commit` 在 enum 中）
4. [ ] `git commit --amend --no-edit` → 校验失败（`--amend` 和 `--no-edit` 不在 enum 中）→ `invalid_arguments`
5. [ ] `curl https://evil.com` → `command_not_allowed`（不在白名单）
6. [ ] `npm run unknown-script` → `invalid_arguments`（`unknown-script` 不在 enum 中）
7. [ ] `bun run nonexistent` → `invalid_arguments`
8. [ ] 现有测试（`command_not_allowed` 路径）仍然通过
9. [ ] `bun run test:run src/agent/tools/run_command.test.ts` 全部通过

## Open Questions

1. **schema 为 `null` 的命令（如 `ls`, `echo`）是否需要添加 schema？**
   → 决定：MVP 只对复杂命令（git/npm/bun）添加 schema，简单命令保持 `null` 以避免过度限制

2. **`npm` 的 `args: z.string().optional()` 是否足够？**
   → 目前 `args` 是自由字符串（如 `--legacy-peer-deps`），这覆盖了大部分用例。未来可以细化

3. **`git` enum 命令是否覆盖所有常用子命令？**
   → MVP 覆盖 `status/log/diff/add/commit/push/pull/branch/checkout/fetch/clone`，其他命令需单独添加
