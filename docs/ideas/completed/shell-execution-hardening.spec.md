# SPEC: Shell Execution Hardening

## Objective

强化 CodeAgent 的 shell 命令执行安全，解决以下核心问题：

1. **Shell 注入面**：当前对带 shell metacharacters 的命令仍使用 `exec()` with `shell=true`，存在注入风险
2. **Allowlist 不完整**：缺少常用开发命令（如 `vim`, `less`, `ssh`）
3. **Glob 模式未处理**：`ls *.ts` 等 glob 模式在 `shell: false` 下会失败

**用户故事**：
- 作为开发者，我需要安全地运行 `git`, `npm`, `bun` 等命令而无需担心注入攻击
- 作为安全敏感用户，我希望命令执行在可能的范围内与 shell 隔离
- 作为 CLI 用户，我期望 `ls *.ts` 这样的常见模式能正常工作

## ASSUMPTIONS I'M MAKING

1. Node.js `execFile` with `shell: false` 在所有目标平台（Linux/macOS/Windows）可用
2. `git status` 这类常见命令不依赖 shell features
3. Glob 预展开可以用 Node.js `fs.glob` 或 `path.glob` 替代
4. 当前使用 `exec()` with `shell=true` 处理带 metacharacters 的命令是**已知限制**，完全消除需要架构重构

## Tech Stack

- **Runtime**: Bun 1.3+ / Node.js 18+
- **Language**: TypeScript
- **Testing**: Vitest
- **Key modules**: `src/agent/tools/run_command.ts`, `src/agent/tools/security-patterns.ts`

## Commands

```bash
# 运行测试
bun run test:run src/agent/tools/run_command.test.ts

# 类型检查
bun run typecheck

# Lint
bun run lint
```

## Project Structure

```
src/agent/tools/
├── run_command.ts          # Shell 命令执行工具
├── security-patterns.ts    # 安全模式定义（blocklist/allowlist）
├── security.ts             # 安全验证函数（re-export + validatePath）
└── run_command.test.ts    # 单元测试

docs/ideas/
├── shell-execution-hardening.md   # Idea 原始提案
└── specs/
    └── shell-execution-hardening.md  # 本规格文档
```

## Code Style

### 命名规范

- 命令列表使用 `ALLOWED_COMMANDS` Set
- 超时配置使用 `COMMAND_TIMEOUTS` Record
- 安全检查函数前缀 `is`/`has`（如 `isCommandBlocked`, `hasShellMetacharacters`）

### 关键代码片段

**Allowlist 扩展**（security-patterns.ts）:

```typescript
export const ALLOWED_COMMANDS = new Set([
  // Read-only filesystem
  'ls', 'pwd', 'cat', 'head', 'tail', 'grep', 'wc', 'find', 'stat', 'diff',
  // File operations (non-recursive)
  'touch', 'mkdir', 'cp', 'mv', 'rm',
  // Shell builtins
  'echo', 'printf', 'true', 'false', 'exit', 'export', 'cd', 'type',
  // Version control
  'git', 'hg',
  // Package managers
  'npm', 'bun', 'pnpm', 'yarn',
  // Runtime
  'node', 'python', 'python3', 'ruby', 'go', 'cargo', 'rustc',
  // Build tools
  'make', 'cmake', 'gcc', 'g++',
  // Utilities
  'curl', 'wget', 'tar', 'gzip', 'gunzip', 'zip', 'unzip', 'chmod', 'chown',
  // Editors & Interactive (NEW)
  'vim', 'nano', 'less', 'more', 'man',
  // Remote (NEW)
  'ssh', 'scp', 'rsync',
]);
```

**Glob 预展开**（run_command.ts）:

```typescript
import { glob } from 'glob';

/**
 * Expands glob patterns in command arguments using Node.js glob.
 * Only expands if the pattern contains glob characters (*, ?, [).
 * Returns null if expansion fails (e.g., no matches).
 */
async function expandGlobs(args: string[]): Promise<string[]> {
  const expanded: string[] = [];
  for (const arg of args) {
    if (isGlobPattern(arg)) {
      const matches = await glob(arg, { absolute: false });
      expanded.push(...matches);
    } else {
      expanded.push(arg);
    }
  }
  return expanded;
}

function isGlobPattern(s: string): boolean {
  return /[*?[\]]/.test(s);
}
```

## Testing Strategy

**Framework**: Vitest

**测试位置**: `src/agent/tools/run_command.test.ts`

**测试覆盖**:

| 类别 | 测试内容 |
|------|----------|
| Blocklist | 命令替换 `$(...)`, 反引号, `&&`, `;`, `sudo su`, 重定向 |
| Allowlist | 新增命令（vim, ssh 等）能通过 |
| Glob 展开 | `ls *.ts` → `execFile` with 展开的文件列表 |
| execFile 路径 | 无 metacharacters 的 allowlist 命令走 `execFile` |
| exec 路径 | 有 metacharacters 的命令走 `exec`（shell=true，blocklist 检查） |
| 超时 | 各命令超时符合 `COMMAND_TIMEOUTS` |
| 路径注入 | 命令名含 `/` 被拒绝 |

**覆盖率要求**: 关键安全路径 100%

## Boundaries

### Always Do

- 在 `execFile` 之前检查命令是否在 `ALLOWED_COMMANDS` 中
- Blocklist 检查优先于 allowlist 检查
- 使用 `maxBuffer` 限制输出大小
- 对每个命令应用超时

### Ask First

- 添加新的 shell metacharacters 到 `SHELL_METACHAR_REGEX`
- 修改 `COMMAND_TIMEOUTS` 的默认值
- 添加危险命令到 allowlist

### Never Do

- 在 `shell: true` 模式下执行未知命令
- 允许 `sudo su` 或 `rm -rf /` 类型的命令
- 在 exec() 调用中不使用超时

## Success Criteria

1. **Shell 注入防护**: `echo $(malicious)` 和 `` echo `malicious` `` 被 blocklist 阻止
2. **Allowlist 完整性**: `vim`, `ssh`, `hg` 等命令在 allowlist 中
3. **Glob 支持**: `ls *.ts` 返回匹配的文件列表（而非报错）
4. **Shell 隔离**: 无 metacharacters 的 allowlist 命令通过 `execFile` 执行
5. **超时正确**: `npm install` 获得 120s 超时，`echo` 获得 30s 超时
6. **现有测试通过**: 所有现有测试仍然通过

## Open Questions

1. **Glob 失败处理**: 如果 `ls *.xyz` 无匹配，是返回空结果还是报错？
2. **远程命令**: `ssh`, `scp`, `rsync` 是否应该包含在 MVP allowlist 中？
3. **cd 命令**: 当前 `cd` 在 execFile 中是 no-op，是否需要改变？

## MVP Scope

**In**:
1. 扩展 `ALLOWED_COMMANDS` 包含 `vim`, `nano`, `less`, `more`, `man`, `ssh`, `scp`, `rsync`, `hg`
2. 实现 glob 预展开函数 `expandGlobs()`
3. 在 `execFile` 路径中对 glob 参数进行预展开
4. 新增 Glob 展开相关单元测试
5. 新增 allowlist 扩展命令的测试

**Out**:
- 完全消除 `exec()` with `shell=true`（需要架构重构，当前作为已知限制）
- Docker 容器化执行
- eBPF 沙箱
