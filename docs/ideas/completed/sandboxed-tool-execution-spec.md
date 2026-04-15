# SPEC: Sandboxed Tool Execution

## Objective

为 CodeAgent 的工具执行层添加 workspace scope 沙箱和命令分级权限控制，使自主/cron 场景下也能安全运行，无需用户持续确认，同时保留用户所需的全部能力。

**用户故事：**
1. 作为 cron job 操作者，我希望工具只能访问项目 workspace 内资源，防止意外的系统文件破坏
2. 作为团队 lead，我希望危险命令（git push --force）有明确提示，而不是静默执行
3. 作为新用户，我不希望第一次运行就遇到 `rm -rf` 式的惊吓

**验收条件：**
- [ ] `CODEAGENT_WORKSPACE_ROOT` 设置后，`run_command` 无法访问 workspace 外的路径
- [ ] 危险命令（如 `rm -rf /`）被 blocked regex 拦截
- [ ] 未 allowlisted 命令（如 `kubectl`）被拒绝，返回清晰的错误信息
- [ ] Session Permission Ledger 追踪已批准的 elevated-tier 命令

## ASSUMPTIONS I'M MAKING

1. **现有安全基础设施可扩展**：`security-patterns.ts` 中的 `BLOCKED_REGEX`、`ALLOWED_COMMANDS`、`COMMAND_ALLOWLIST`、`validatePath()` 可直接复用和扩展，不需要重写
2. **Workspace root 验证优先级**：在 `run_command` 中添加 workspace validation 是 MVP 的核心（其他提案如 `sandboxed-tool-execution.md` 的 MVP scope 明确指出这一点）
3. **Session Permission Ledger 是内存级**：不需要持久化，per-session 状态，重启即清
4. **Dangerous tier 命令需要 always-confirm**：不是直接阻止，而是触发现有的 confirm modal
5. **工具层拦截位置正确**：在 tool handler 内部拦截（而非 agent 层），不影响 MCP 工具
6. **Elevated tier 命令在 session 内只需确认一次**：ledger key = command signature

→ 如果以上假设有误，请立即纠正。

## Tech Stack

- **框架**：TypeScript + Node.js/Bun
- **关键依赖**：无新增外部依赖，使用 stdlib `path`, `fs`, `child_process`
- **现有基础设施复用**：
  - `src/agent/tools/security-patterns.ts` — blocked regex, command allowlist, path validation
  - `src/agent/tools/run_command.ts` — 已有 execFile/exec 分离逻辑
  - `src/agent/tools/write_file.ts` — 已有 workspace root validation（参考实现）
  - `src/agent/tools/search_files.ts` — 已有 validatePath 集成

## Commands

```bash
# 开发测试
bun test                              # 运行所有测试
bun test src/agent/tools/             # 运行工具层测试

# 手动验证
export CODEAGENT_WORKSPACE_ROOT=/tmp/test-workspace
mkdir -p $CODEAGENT_WORKSPACE_ROOT
cd $CODEAGENT_WORKSPACE_ROOT
# 应该能执行
bun run codeagent -- eval 'ls'
# 应该被拒绝（workspace 外）
bun run codeagent -- eval 'ls /etc'
```

## Project Structure

```
src/agent/tools/
├── security-patterns.ts    # 现有：blocked regex, allowlist, validatePath()
├── run_command.ts           # 修改：添加 workspace root 验证 + command tier 分类
├── write_file.ts            # 现有：已有 validatePath，参考实现
├── read_file.ts             # 现有：已有 workspace validation（需检查动态解析）
├── search_files.ts          # 现有：已有 validatePath 集成
├── sandbox/
│   ├── index.ts             # 新增：SandboxContext 导出
│   ├── workspace.ts         # 新增：workspace root 解析和验证
│   ├── permission-ledger.ts # 新增：session-scoped permission ledger
│   └── command-tiers.ts     # 新增：命令分级（Safe/Elevated/Dangerous）
```

## Code Style

### Workspace Root 验证模式

```typescript
// 从 security-patterns.ts 的 validatePath 获取 resolvedPath
import { validatePath } from './security-patterns.js';

function getWorkspaceRoot(): string {
  return process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();
}

function validateWorkspace(command: string): { valid: boolean; reason?: string } {
  // 对于 run_command，检查命令中是否有路径参数试图逃逸 workspace
  // 简化：仅检查绝对路径
  const tokens = command.split(/\s+/);
  for (const token of tokens) {
    if (token.startsWith('/') && token.length > 1) {
      // 绝对路径 — 检查是否在 workspace 内
      const resolved = validatePath(token, getWorkspaceRoot());
      if (!resolved) {
        return { valid: false, reason: `Path outside workspace: ${token}` };
      }
    }
  }
  return { valid: true };
}
```

### Permission Ledger 模式

```typescript
// src/agent/tools/sandbox/permission-ledger.ts

type PermissionTier = 'safe' | 'elevated' | 'dangerous';

interface PermissionEntry {
  tier: PermissionTier;
  approvedAt: number;
}

// Session-scoped permission ledger — in-memory, resets per session
class PermissionLedger {
  private ledger = new Map<string, PermissionEntry>();

  // Key = command base name (e.g., 'git')
  has(baseCmd: string, tier: PermissionTier): boolean {
    const entry = this.ledger.get(baseCmd);
    if (!entry) return tier === 'safe'; // Safe tier is default-approved
    return entry.tier === tier;
  }

  approve(baseCmd: string, tier: PermissionTier): void {
    this.ledger.set(baseCmd, { tier, approvedAt: Date.now() });
  }

  clear(): void {
    this.ledger.clear();
  }
}
```

### Command Tier Classification

```typescript
// src/agent/tools/sandbox/command-tiers.ts

export type CommandTier = 'safe' | 'elevated' | 'dangerous';

/**
 * Classifies a command into its permission tier.
 * - safe: auto-approved, runs via execFile (shell-isolated)
 * - elevated: approved once per session, runs via execFile
 * - dangerous: always requires confirmation, blocked by default
 */
export function classifyCommand(command: string): CommandTier {
  const baseCmd = command.trim().split(/\s+/)[0]?.toLowerCase() || '';
  
  // Dangerous: known destructive patterns
  if (DANGEROUS_COMMANDS.has(baseCmd)) return 'dangerous';
  
  // Elevated: commands that modify state (git push, npm install, etc.)
  if (ELEVATED_COMMANDS.has(baseCmd)) return 'elevated';
  
  return 'safe';
}

const DANGEROUS_COMMANDS = new Set(['rm', 'dd', 'mkfs', 'fdisk']);
const ELEVATED_COMMANDS = new Set([
  'git push', 'git push --force', 'npm publish', 
  'docker rmi', 'docker rm', 'kill', 'pkill'
]);
```

## Testing Strategy

### 框架

Vitest（与项目现有测试一致）

### 测试文件位置

- `src/agent/tools/run_command.test.ts` — 扩展现有测试
- `src/agent/tools/sandbox/` — 新增沙箱模块测试

### 测试覆盖要求

**必须覆盖：**
1. Workspace root 外路径的 `run_command` 拒绝
2. Safe tier 命令自动执行（无需确认）
3. Elevated tier 命令首次执行时触发确认
4. Elevated tier 命令 session 内二次执行时自动通过
5. Dangerous tier 命令总是被拦截

### 边界条件测试

```typescript
// run_command workspace 边界
test('rejects command with absolute path outside workspace', async () => {
  process.env.CODEAGENT_WORKSPACE_ROOT = '/tmp/sandbox';
  // Try to read /etc/passwd
  const result = await runCommand.execute('fake-id', { command: 'cat /etc/passwd' });
  expect(result.details.success).toBe(false);
  expect(result.details.reason).toBe('path_outside_workspace');
});
```

## Boundaries

- **Always：**
  - 所有文件操作必须经过 `validatePath()` 检查
  - 所有命令必须经过 `BLOCKED_REGEX` 检查（在任何 allowlist 之前）
  - Workspace root 通过 `process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd()` 解析
  - 权限确认使用现有的 confirm modal，不是新建 UI

- **Ask first：**
  - 添加新的 dangerous command pattern 到 `BLOCKED_REGEX`
  - 修改命令分级阈值
  - 更改默认 workspace root 行为

- **Never：**
  - 在 tool handler 外拦截命令（会影响 MCP 工具）
  - 实现 Docker/VM 级别的进程隔离
  - 将 permission ledger 持久化到磁盘
  - 修改现有工具的函数签名

## Success Criteria

### 核心完成条件

1. [ ] `CODEAGENT_WORKSPACE_ROOT=/tmp/test` 时，`run_command('cat /etc/passwd')` 返回 `path_outside_workspace` 错误
2. [ ] Safe tier 命令（如 `ls`, `cat`, `git status`）在 session 内自动执行，无需确认
3. [ ] Elevated tier 命令（如 `git push`）首次执行触发 confirm modal，批准后 session 内自动通过
4. [ ] Dangerous tier 命令（如包含 `rm -rf` 的命令）始终被 `BLOCKED_REGEX` 拦截
5. [ ] `bun test src/agent/tools/` 全部通过（无回归）

### 回归检查

- [ ] 现有 `run_command.test.ts` 全部通过
- [ ] `write_file`、`read_file`、`search_files` 的 workspace validation 仍然正常工作

## Open Questions

1. **Workspace 内嵌工具问题**：`curl`、`wget`、`ssh` 等工具可能需要访问外部 URL 或远程主机——是否将它们归为 Elevated tier 而非 Safe tier？
2. **Subshell/command substitution**：`$(...)` 和 `` `...` `` 在命令中被 `SHELL_METACHAR_REGEX` 拦截（正确），但如何处理 `eval $VAR` 这类间接路径？
3. **Interactive commands**：`vim`、`nano`、`less` 等交互式命令在 execFile 模式下无法工作——是否允许它们使用 exec() 而带 workspace 限制？
4. **read_file workspace root 缓存 bug**：`read_file.ts` 中 `WORKSPACE_ROOT` 是模块级常量，可能在测试中过时——是否改为函数调用？
