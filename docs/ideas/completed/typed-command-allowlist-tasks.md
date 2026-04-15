# 任务拆分：Typed Command Allowlist

## 关联 SPEC

- **规格文档**：`docs/ideas/todo/typed-command-allowlist-spec.md`

## Idea 信息

- **文件**：`docs/ideas/todo/typed-command-allowlist.md`
- **Problem Statement**：未知命令静默 fallback 到 `exec()` with `shell=true`，绕过白名单意图；需要用 Zod schema 对白名单命令做参数级校验
- **MVP Scope**：
  1. `COMMAND_ALLOWLIST`（带 Zod schema）替换 `ALLOWED_COMMANDS`（Set）
  2. `run_command.ts` 增加 `safeParse()` 校验
  3. `COMMAND_NOT_ALLOWED` 替换隐式 fallback（已实现）
  4. 测试覆盖新拒绝路径

## 任务列表

### Task 1: 定义 COMMAND_ALLOWLIST 带 Zod Schema

**验收标准**：
- [ ] `COMMAND_ALLOWLIST` 是一个 `Record<string, z.ZodType | null>` 类型的常量
- [ ] `git` 命令有 `z.enum(['status','log','diff','add','commit','push','pull','branch','checkout','fetch','clone'])` schema
- [ ] `npm` 命令有 `z.object({ command: z.enum([...]), args: z.string().optional() })` schema
- [ ] `bun` 命令有 `z.object({ command: z.enum([...]), script: z.string().optional() })` schema
- [ ] `ls`、`cat`、`echo` 等简单命令的 schema 为 `null`
- [ ] `COMMAND_ALLOWLIST` 导出供 `run_command.ts` 使用

**TDD 步骤**：
- RED：先写测试期望 `COMMAND_ALLOWLIST` 有正确结构
- GREEN：在 `security-patterns.ts` 中定义 `COMMAND_ALLOWLIST`

**文件**：
- `src/agent/tools/security-patterns.ts`

**估算规模**：S（1-2 个文件）

---

### Task 2: 更新 run_command.ts 增加参数校验

**验收标准**：
- [ ] `run_command.ts` import `COMMAND_ALLOWLIST`（从 `security-patterns.js`）
- [ ] 在 `execFile` 路径（行 136-163）中，baseCmd 在白名单时，获取 `COMMAND_ALLOWLIST[baseCmd]`
- [ ] 如果 schema !== null，调用 `schema.safeParse(args_object)` 校验
- [ ] 校验失败时返回 `{ reason: 'invalid_arguments', ... }` + 清晰错误信息
- [ ] schema === null 时直接执行（保持向后兼容）

**TDD 步骤**：
- RED：先写测试 `git commit -m "test"` → `invalid_arguments`（因为 `commit` enum 中没有 `-m`）
- GREEN：实现参数提取 + safeParse 逻辑
- REFACTOR：如需要，提取 `validateArgs()` 辅助函数

**文件**：
- `src/agent/tools/run_command.ts`

**估算规模**：M（3-5 个文件）

---

### Task 3: 增加 invalid_arguments 测试用例

**验收标准**：
- [ ] `git commit -m "test"` → `invalid_arguments`（`-m` 不在 enum 中）
- [ ] `git commit --amend` → `invalid_arguments`
- [ ] `npm run unknown-script` → `invalid_arguments`
- [ ] `npm run build -- --unknown-flag` → `invalid_arguments`（`--unknown-flag` 不被 `args` 接受）
- [ ] `bun run nonexistent` → `invalid_arguments`
- [ ] `bun run build --prod` → `invalid_arguments`（`--prod` 不在 schema 中）

**TDD 步骤**：
- RED：写上述测试，确认失败（reason 不匹配）
- GREEN：运行测试，通过

**文件**：
- `src/agent/tools/run_command.test.ts`

**估算规模**：S（1-2 个文件）

---

### Task 4: 验证全部测试通过

**验收标准**：
- [ ] `bun run test:run src/agent/tools/run_command.test.ts` 全部通过
- [ ] `bun run test:run` 全部通过（无回归）
- [ ] `bun tsc --noEmit` 无错误

**验证步骤**：
```bash
bun run test:run src/agent/tools/run_command.test.ts
bun run test:run
bun tsc --noEmit
```

**估算规模**：XS（验证步骤）

---

## 依赖关系

```
Task 1 → Task 2 → Task 3 → Task 4
  ↑_________↓ （测试先写）
```

**Task 2 依赖 Task 1**：必须先定义 `COMMAND_ALLOWLIST`
**Task 3 依赖 Task 2**：测试需要校验逻辑已实现
**Task 4 依赖 Task 3**：验证所有测试通过

## Checkpoint: 全部任务完成后

- [ ] `COMMAND_ALLOWLIST` 带 Zod schema 已定义
- [ ] `run_command.ts` 实现参数校验
- [ ] `git commit -m "test"` → `invalid_arguments`
- [ ] `npm run build` → 合法参数，执行成功
- [ ] `bun run build` → 合法参数，执行成功
- [ ] 所有测试通过，无 TypeScript 错误
