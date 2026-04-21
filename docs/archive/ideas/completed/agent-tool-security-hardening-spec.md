# SPEC: Agent Tool Security Hardening

## Objective

修复 CodeAgent 工具执行层的三个关键安全漏洞：

1. **Shell 命令注入绕过**（`run_command.ts`）：无 shell metacharacter 的命令通过 `execFile()` 执行，但代码中**未显式设置 `shell: false`**。需要确认 `execFile()` 的默认行为并确保安全。
2. **Session ID 路径遍历**（`sessions.ts`, `sessionRepository.ts`）：需要验证 `isValidSessionId()` 已正确接入所有入口。
3. **无界资源消耗**（`search_files.ts`）：`MAX_FILES = 5000` 已实现，需要确认该常量存在且有效。

## ASSUMPTIONS I'M MAKING

1. `execFile()` 在 Node.js 中默认 `shell: false`（不需要手动设置）
2. `search_files.ts` 中的 `MAX_FILES = 5000` 是有效的无界文件计数防护
3. Session ID 验证已通过 `isValidSessionId()` 在 `sessions.ts` 和 `sessionRepository.ts` 中正确接入
4. `security-patterns.ts` 中的 `validateSessionId()` 是 Session ID 验证的单一真实来源

→ 如果以上假设有误，请纠正。

## Tech Stack

- **Runtime**: Node.js (Bun)
- **Language**: TypeScript 5.x
- **Framework**: `@mariozechner/pi-agent-core`
- **Testing**: Vitest

## Commands

```
Test: bun run test:run
Lint: bun run lint
Build: npm run build
Dev: npm run dev
```

## Project Structure

```
src/agent/tools/
├── run_command.ts          # Shell 命令执行工具（修复 shell:false 明确设置）
├── security-patterns.ts    # 安全模式定义（单一真实来源）
├── security.ts             # 安全检查辅助函数
├── search_files.ts         # 文件搜索工具（MAX_FILES 已存在）
└── session*.ts             # 会话管理（isValidSessionId 已接入）

tests/unit/agent/tools/
├── run_command.test.ts     # Shell 执行安全测试
└── security-patterns.test.ts # 安全模式测试
```

## Code Style

### Shell 执行（run_command.ts）

```typescript
// ✅ 无 shell metacharacter 的命令使用 execFile（默认 shell:false）
const { stdout, stderr } = await execFileAsync(cmd, args, { timeout, maxBuffer: MAX_BUFFER_SIZE });

// ⚠️ 有 shell metacharacter 的命令使用 exec() with shell:true（受限）
const { stdout, stderr } = await execAsync(command, {
  timeout,
  maxBuffer: MAX_BUFFER_SIZE,
  shell: true,
});
```

### Session ID 验证（sessionUtils.ts）

```typescript
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_SESSION_ID_LENGTH = 255;

export function isValidSessionId(id: string): boolean {
  return SESSION_ID_REGEX.test(id) && id.length > 0 && id.length <= MAX_SESSION_ID_LENGTH;
}
```

### 文件计数限制（search_files.ts）

```typescript
const MAX_FILES = 5000;
const MAX_DEPTH = 20;

if (depth > MAX_DEPTH || matches.length >= maxResults || filesScanned >= MAX_FILES) return;
```

## Testing Strategy

- **Framework**: Vitest
- **测试文件**: `tests/unit/agent/tools/run_command.test.ts`, `tests/unit/agent/tools/security-patterns.test.ts`
- **覆盖率目标**: Shell 执行分支 100%，Session ID 验证 100%

### Test Cases

1. **Shell 注入防护**: 验证 `;rm -rf /` 被阻止
2. **allowlist 执行**: 验证 `git status` 通过 `execFile()` 执行
3. **非 allowlist 拒绝**: 验证未知命令被拒绝
4. **Session ID 验证**: 验证 `../` 被拒绝，`valid-id-123` 通过
5. **文件计数上限**: 验证超过 5000 文件时搜索中止

## Boundaries

- Always: 在 `execFile()` 调用中显式设置 `shell: false`（即使 Node.js 默认值是 false）
- Always: 所有外部输入（command, session ID, path）在使用前必须验证
- Ask first: 修改 `BLOCKED_REGEX` 或 `ALLOWED_COMMANDS` 集合
- Never: 不对非 allowlist 命令静默降级到 `exec()` with `shell=true`
- Never: 不修改 `MAX_FILES = 5000` 或 `MAX_DEPTH = 20` 的安全限制

## Success Criteria

1. `run_command.ts` 中所有 `execFile()` 调用显式设置 `shell: false`
2. Session ID 验证在 `sessions.ts` 和 `sessionRepository.ts` 的所有公共方法中生效
3. `search_files.ts` 中 `MAX_FILES = 5000` 和 `MAX_DEPTH = 20` 限制有效
4. 现有测试全部通过：`bun run test:run`
5. 新增的安全测试覆盖所有三个漏洞的修复验证

## Open Questions

1. 是否需要在 `execFile()` 中显式设置 `shell: false`（Node.js 文档说明默认值即为 false）？
2. `security.ts` 中的 `validateSessionId()` 与 `sessionUtils.ts` 中的 `isValidSessionId()` 是否重复？是否应该统一？
