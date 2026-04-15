# SPEC: Secure Tool Sandbox

## ASSUMPTIONS I'M MAKING

1. `src/agent/tools/` 包含所有工具实现（read_file.ts, write_file.ts, list_directory.ts, search_files.ts, run_command.ts）
2. `read_file.ts` 和 `write_file.ts` 已有 workspace root 验证（idea 中已确认）
3. `list_directory.ts` 和 `search_files.ts` 当前无路径遍历保护
4. `run_command.ts` 使用正则 blocking + `RUN_COMMAND_UNSAFE` 环境变量绕过
5. 项目使用 TypeScript + Vitest 测试
6. 默认 workspace root 为 `process.cwd()`
7. 工具函数签名中已有 `workspaceRoot` 参数或等效参数

→ 如果以上假设有误，我会导致实现错误，请立即纠正。

---

## Objective

为 CodeAgent 构建统一的安全中间件层，确保所有文件和命令工具通过一致的路径验证和命令白名单机制防护，消除当前的安全态势不一致问题。

**用户故事：**
- 作为 CodeAgent 用户，我希望工具自动拒绝 workspace 外的路径操作，防止意外访问系统敏感文件
- 作为 CodeAgent 用户，我希望命令执行使用显式白名单而非正则黑名单，消除被绕过的可能性
- 作为 CodeAgent 开发者，我希望所有工具共享统一的验证逻辑，便于维护和审查

**验收条件：**
- `list_directory` 拒绝 `../` 逃逸路径
- `search_files` 拒绝 `../` 逃逸路径
- `run_command` 移除 `RUN_COMMAND_UNSAFE` 绕过机制，改用显式白名单
- 所有路径验证通过 `security.ts` 共享函数执行
- 单元测试覆盖 `security.ts` 所有验证函数

---

## Tech Stack

- **语言：** TypeScript 5.x
- **测试框架：** Vitest
- **路径工具：** Node.js `path` 模块（`path.resolve()`, `path.relative()`）
- **依赖：** 无新依赖——所有工具使用 Node.js 标准库

---

## Commands

```bash
# 运行所有测试
bun run test:run

# 运行 security 相关测试
bun run test:run --filter="security"

# 运行单个测试文件
bun run test:run src/agent/tools/security.test.ts

# Lint
npm run lint

# 构建
npm run build
```

---

## Project Structure

```
src/agent/tools/
├── security.ts           # 【新增】统一安全中间件
├── security.test.ts      # 【新增】安全函数单元测试
├── read_file.ts          # 【修改】已有 workspace 验证
├── write_file.ts         # 【修改】已有 workspace 验证
├── list_directory.ts     # 【修改】添加路径遍历保护
├── search_files.ts       # 【修改】添加路径遍历保护
└── run_command.ts        # 【修改】移除 RUN_COMMAND_UNSAFE，改用白名单
```

---

## Code Style

### security.ts 核心函数

```typescript
import path from 'path';

/**
 * 验证路径是否在 workspace root 内
 * @param requestedPath 用户请求的路径
 * @param workspaceRoot workspace 根目录
 * @returns 规范化后的安全路径，或 null（如果路径在 workspace 外）
 */
export function validatePath(
  requestedPath: string,
  workspaceRoot: string
): string | null {
  const resolved = path.resolve(workspaceRoot, requestedPath);
  const rel = path.relative(workspaceRoot, resolved);
  // 如果相对路径以 .. 开头，说明在 workspace 外
  if (rel.startsWith('..')) {
    return null;
  }
  return resolved;
}

/**
 * 显式命令白名单
 * 允许的命令：git, npm, bun, node, pnpm, yarn, npx, deno
 */
const ALLOWED_COMMANDS = new Set([
  'git', 'npm', 'bun', 'node', 'pnpm', 'yarn', 'npx', 'deno',
]);

/**
 * 验证命令是否在白名单中
 * @param cmd 要执行的命令
 * @returns true 如果命令被允许
 */
export function isCommandAllowed(cmd: string): boolean {
  return ALLOWED_COMMANDS.has(cmd);
}
```

### 工具中的使用模式

```typescript
// list_directory.ts 修改示例
import { validatePath } from './security';

function listDirectory(dir: string, workspaceRoot: string): string | null {
  const safePath = validatePath(dir, workspaceRoot);
  if (!safePath) {
    throw new Error('TOOL_PERMISSION_DENIED: 路径在 workspace 外');
  }
  // 原有逻辑...
}
```

---

## Testing Strategy

### 测试框架

- **框架：** Vitest
- **测试位置：** `src/agent/tools/security.test.ts`

### 测试覆盖

| 函数 | 测试用例 |
|------|---------|
| `validatePath` | 正常相对路径、绝对路径、`../` 逃逸、`/../` 混合路径、符号链接模拟 |
| `isCommandAllowed` | 白名单内命令、白名单外命令、含参数命令（如 `git status`） |

### 边界测试用例

```typescript
// validatePath 边界测试
expect(validatePath('./src', '/home/user/project')).toBe('/home/user/project/src');
expect(validatePath('../etc/passwd', '/home/user/project')).toBe(null);
expect(validatePath('/etc/passwd', '/home/user/project')).toBe(null);
expect(validatePath('src/../src', '/home/user/project')).toBe('/home/user/project/src');

// isCommandAllowed 边界测试
expect(isCommandAllowed('git')).toBe(true);
expect(isCommandAllowed('git status')).toBe(true); // 仅检查命令名
expect(isCommandAllowed('rm')).toBe(false);
expect(isCommandAllowed('curl')).toBe(false);
expect(isCommandAllowed('nc')).toBe(false);
```

---

## Boundaries

**Always（必须做）：**
- 所有文件/命令工具必须通过 `security.ts` 的验证函数
- 路径验证使用 `path.resolve()` 规范化后再比较
- 命令白名单是唯一的放行机制（无隐式 fallback）
- 安全检查失败时抛出明确的错误类型

**Ask first（需要先询问）：**
- 添加新命令到白名单（需要评估安全影响）
- 修改现有工具的函数签名

**Never（绝不能做）：**
- `RUN_COMMAND_UNSAFE` 绕过机制不得以任何形式保留
- 不使用 `eval()` 或 `new Function()` 执行命令
- 不在白名单中添加 shell 解释器（`sh`, `bash`, `zsh`）
- 不在安全检查失败时降级为警告而非拒绝

---

## Success Criteria

1. [ ] `src/agent/tools/security.ts` 存在并导出 `validatePath` 和 `isCommandAllowed`
2. [ ] `list_directory.ts` 调用 `validatePath` 并在路径越界时抛出错误
3. [ ] `search_files.ts` 调用 `validatePath` 并在路径越界时抛出错误
4. [ ] `run_command.ts` 移除 `RUN_COMMAND_UNSAFE` 环境变量检查
5. [ ] `run_command.ts` 使用 `isCommandAllowed` 白名单验证
6. [ ] `security.test.ts` 存在并包含完整边界测试
7. [ ] `bun run test:run` 所有测试通过（包括新增的安全测试）
8. [ ] `npm run build` 成功构建，无类型错误

---

## Open Questions

1. **Workspace root 配置方式：** 目前假设使用 `process.cwd()`，是否需要支持 `.codeagentrc` 配置文件？
2. **审计日志：** 是否需要记录所有被阻止的操作？（建议后续迭代添加）
3. **`npm install` 场景：** 用户可能需要在 workspace 外执行 `npm install`，白名单是否满足？（`npm` 已在白名单）
