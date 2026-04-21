# 任务拆分：Sandboxed Tool Execution

## 关联 SPEC

- **规格文档**：`docs/ideas/todo/sandboxed-tool-execution-spec.md`

## Idea 信息

- **文件**：`docs/ideas/todo/sandboxed-tool-execution.md`
- **Problem Statement**：CodeAgent 的工具执行层缺少统一的 workspace scope 沙箱和命令分级权限控制
- **MVP Scope**：
  - `CODEAGENT_WORKSPACE_ROOT` env var 设置沙箱边界
  - `read_file` 和 `write_file` 已有路径验证，扩展到 `run_command`
  - `run_command` 命令分级（Safe/Elevated/Dangerous 三级）
  - Session Permission Ledger（内存级）
  - 废弃 `RUN_COMMAND_UNSAFE`，用 `CODEAGENT_WORKSPACE_ROOT` 替代

---

## 任务列表

### Task 1: 创建沙箱目录结构和 PermissionLedger

**描述**：创建 `src/agent/tools/sandbox/` 目录和 `permission-ledger.ts`，实现 session-scoped 内存权限分类账。

**验收标准**：

- [ ] `src/agent/tools/sandbox/permission-ledger.ts` 导出 `PermissionLedger` 类
- [ ] `has(cmd, tier)` — Safe tier 默认批准，Elevated/Dangerous 需 ledger 中有记录
- [ ] `approve(cmd, tier)` — 记录命令到 ledger
- [ ] `clear()` — 清空 ledger（session 结束时）
- [ ] Tier 类型为 `'safe' | 'elevated' | 'dangerous'`

**TDD 步骤**：RED → GREEN → REFACTOR

**验证**：

- `bun test src/agent/tools/sandbox/permission-ledger.test.ts` 通过

**依赖**：Task 1（无依赖，独立）

**文件**：

- `src/agent/tools/sandbox/permission-ledger.ts`（新建）
- `src/agent/tools/sandbox/permission-ledger.test.ts`（新建）

**估算规模**：XS（1-2 文件）

---

### Task 2: 创建 command-tiers.ts — 命令分级分类器

**描述**：实现 `classifyCommand()` 函数，将命令分类为 Safe/Elevated/Dangerous 三级。

**验收标准**：

- [ ] `classifyCommand('ls')` → `'safe'`
- [ ] `classifyCommand('git push')` → `'elevated'`
- [ ] `classifyCommand('rm -rf')` → `'dangerous'`
- [ ] BLOCKED_REGEX 覆盖的命令 → `'dangerous'`
- [ ] 从 `security-patterns.ts` 复用 `BLOCKED_REGEX` 和 `ALLOWED_COMMANDS`

**TDD 步骤**：RED → GREEN → REFACTOR

**验证**：

- `bun test src/agent/tools/sandbox/command-tiers.test.ts` 通过

**依赖**：无

**文件**：

- `src/agent/tools/sandbox/command-tiers.ts`（新建）
- `src/agent/tools/sandbox/command-tiers.test.ts`（新建）

**估算规模**：XS

---

### Task 3: 创建 workspace.ts — workspace root 解析

**描述**：实现 workspace root 解析和路径验证辅助函数，复用 `security-patterns.ts` 的 `validatePath`。

**验收标准**：

- [ ] `getWorkspaceRoot()` 优先返回 `CODEAGENT_WORKSPACE_ROOT`，否则 `process.cwd()`
- [ ] `validateCommandPaths(cmd)` 检查命令中的绝对路径是否在 workspace 内
- [ ] 不在 workspace 内的绝对路径返回 `{ valid: false, reason: 'path_outside_workspace' }`

**TDD 步骤**：RED → GREEN → REFACTOR

**验证**：

- `bun test src/agent/tools/sandbox/workspace.test.ts` 通过

**依赖**：无

**文件**：

- `src/agent/tools/sandbox/workspace.ts`（新建）
- `src/agent/tools/sandbox/workspace.test.ts`（新建）

**估算规模**：XS

---

### Task 4: 创建 sandbox/index.ts — 统一导出

**描述**：创建 `sandbox/index.ts` 统一导出 PermissionLedger、classifyCommand、workspace helpers。

**验收标准**：

- [ ] 导出 `PermissionLedger`、`classifyCommand`、`getWorkspaceRoot`、`validateCommandPaths`
- [ ] 在 `tools/index.ts` 中导入 sandbox 模块（用于后续集成）

**验证**：

- `tsc --noEmit` 无错误

**依赖**：Task 1、2、3

**文件**：

- `src/agent/tools/sandbox/index.ts`（新建）

**估算规模**：XS

---

### Task 5: 集成 PermissionLedger 到 run_command（Elevated tier 确认）

**描述**：修改 `run_command.ts`，将命令分级集成到执行流程。对于 Elevated tier 命令，使用 PermissionLedger 实现"session 内确认一次"的 UX。

**验收标准**：

- [ ] Safe tier 命令（如 `ls`）→ 自动执行
- [ ] Elevated tier 命令 → 检查 ledger，有记录则自动执行，无记录则返回需要确认
- [ ] Dangerous tier 命令 → 直接被 blocked
- [ ] `approve(cmd)` 调用 ledger.approve()

**注意**：此任务**仅修改 run_command.ts**，添加 Elevated tier 检查逻辑，不修改现有测试结构。

**TDD 步骤**：RED（添加新测试）→ GREEN → REFACTOR

**验证**：

- `bun test src/agent/tools/run_command.test.ts` 全部通过（无回归）

**依赖**：Task 1、2

**文件**：

- `src/agent/tools/run_command.ts`（修改）
- `src/agent/tools/run_command.test.ts`（扩展）

**估算规模**：S

---

### Task 6: 集成 validateCommandPaths 到 run_command

**描述**：在 `run_command.ts` 中添加 workspace root 路径验证，防止通过绝对路径逃逸 workspace。

**验收标准**：

- [ ] `CODEAGENT_WORKSPACE_ROOT=/tmp/sandbox` 时，`run_command('cat /etc/passwd')` 返回 `path_outside_workspace`
- [ ] workspace 内的绝对路径（如 `/tmp/sandbox/file.txt`）正常执行

**TDD 步骤**：RED（添加测试）→ GREEN → REFACTOR

**验证**：

- `bun test src/agent/tools/run_command.test.ts` 通过

**依赖**：Task 3、5

**文件**：

- `src/agent/tools/run_command.ts`（修改）

**估算规模**：S

---

### Task 7: 废弃 RUN_COMMAND_UNSAFE，文档更新

**描述**：从代码和文档中移除 `RUN_COMMAND_UNSAFE`，替换为 `CODEAGENT_WORKSPACE_ROOT` 相关文档。

**验收标准**：

- [ ] `RUN_COMMAND_UNSAFE` 相关代码被移除或标记为 deprecated
- [ ] 相关文档更新

**验证**：

- 代码中无 `RUN_COMMAND_UNSAFE` 引用（或仅标记 deprecated）

**依赖**：Task 5、6

**文件**：

- 可能涉及：`src/agent/tools/run_command.ts`、`docs/` 配置文档

**估算规模**：XS

---

### Task 8: 集成测试 — 端到端沙箱行为验证

**描述**：编写集成测试验证完整的沙箱行为：workspace 设置 → Safe tier 自动执行 → Elevated tier 首次确认 → 二次自动通过。

**验收标准**：

- [ ] 测试覆盖完整流程
- [ ] `bun test src/agent/tools/sandbox/` 全部通过

**依赖**：Task 1-7

**文件**：

- `src/agent/tools/sandbox/integration.test.ts`（新建）

**估算规模**：M

---

## Checkpoint：After Tasks 1-4（基础模块）

- [ ] 所有沙箱模块测试通过
- [ ] `tsc --noEmit` 无错误
- [ ] 代码风格符合项目规范

---

## Checkpoint：After Tasks 5-7（集成完成）

- [ ] `run_command.test.ts` 全部通过（无回归）
- [ ] Workspace root 验证正常
- [ ] 命令分级逻辑正常

---

## Checkpoint：Final（所有任务完成）

- [ ] 所有测试通过
- [ ] `bun test src/agent/tools/` 全部通过
- [ ] SPEC 中的所有验收条件满足
- [ ] 代码已提交（带 Conventional Commits）

---

## 风险和缓解

| 风险                                      | 影响 | 缓解                                    |
| ----------------------------------------- | ---- | --------------------------------------- |
| read_file.ts 中 WORKSPACE_ROOT 模块级缓存 | 中   | 已在 Open Questions 中标注，非 MVP 范围 |
| Elevated tier 确认 UX 影响现有流程        | 中   | 使用现有 confirm modal，不新建 UI       |
| 命令分级边界情况遗漏                      | 中   | 充分扩展 allowlist + blocked regex      |

---

## Open Questions（来自 SPEC）

1. `curl`/`wget` 等工具访问外部 URL — MVP 归为 Safe tier（现有 allowlist 已含）
2. Subshell/eval 间接路径 — `SHELL_METACHAR_REGEX` 已拦截 `$(...)`
3. Interactive commands (vim/nano) — MVP 不处理，保持现状
4. read_file workspace root 缓存 — 已在 SPEC Open Questions 中标注，非 MVP 范围
