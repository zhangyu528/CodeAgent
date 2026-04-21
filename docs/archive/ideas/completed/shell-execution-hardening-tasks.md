# 任务拆分：Shell Execution Hardening

## 关联 SPEC

- **规格文档**: `docs/ideas/specs/shell-execution-hardening.md`

## Idea 信息

- **文件**: `docs/ideas/todo/shell-execution-hardening.md`
- **Problem Statement**: Shell 命令执行存在注入风险，allowlist 不完整，缺少 glob 预展开支持
- **MVP Scope**:
  1. 扩展 `ALLOWED_COMMANDS` 包含 `vim`, `nano`, `less`, `more`, `man`, `ssh`, `scp`, `rsync`, `hg`
  2. 实现 glob 预展开函数 `expandGlobs()`
  3. 在 `execFile` 路径中对 glob 参数进行预展开
  4. 新增相关单元测试

## 任务列表

### Task 1: 扩展 ALLOWED_COMMANDS

**验收标准**:

- [ ] `vim`, `nano`, `less`, `more`, `man`, `ssh`, `scp`, `rsync`, `hg` 在 `ALLOWED_COMMANDS` 中
- [ ] 现有命令 `git`, `npm`, `bun`, `node` 等仍然存在
- [ ] 新增命令不影响现有安全检查

**TDD 步骤**:

- RED: 添加测试验证新命令可执行（mock execFile 通过）
- GREEN: 在 `security-patterns.ts` 中将新命令添加到 `ALLOWED_COMMANDS` Set
- REFACTOR: 无需重构

**文件**: `src/agent/tools/security-patterns.ts`

**Estimated scope**: XS（1 文件，Set 添加新元素）

---

### Task 2: 实现 glob 预展开函数

**验收标准**:

- [ ] `isGlobPattern()` 正确识别 `*.ts`, `src/**/*.js`, `file[0-9].txt` 等模式
- [ ] `isGlobPattern()` 对普通文件名返回 false
- [ ] `expandGlobs()` 对 glob 模式返回匹配文件列表
- [ ] `expandGlobs()` 对非 glob 参数原样返回

**TDD 步骤**:

- RED: 编写 `isGlobPattern()` 和 `expandGlobs()` 测试，验证 glob 识别和展开
- GREEN: 实现 `isGlobPattern()` 使用正则 `/[*?[\]]/` 检测
- GREEN: 实现 `expandGlobs()` 使用 Node.js `fs.globSync` 同步展开
- REFACTOR: 无需重构

**文件**: `src/agent/tools/run_command.ts`（新增辅助函数）

**Estimated scope**: S（1-2 文件，2 个辅助函数）

---

### Task 3: 在 execFile 路径中集成 glob 展开

**验收标准**:

- [ ] `ls *.ts` 命令通过 `execFile` 执行时，glob 被预展开为匹配文件列表
- [ ] `ls *.ts` 无匹配时返回空列表或适当错误
- [ ] `echo hello` 等非 glob 命令不受影响

**TDD 步骤**:

- RED: 编写测试 `ls *.ts` 调用 `execFile` with 展开的参数
- GREEN: 在 `execFile` 路径中调用 `expandGlobs(args)` 预展开
- REFACTOR: 提取 `expandGlobs` 为独立函数

**文件**: `src/agent/tools/run_command.ts`

**Estimated scope**: S（修改现有 execFile 路径逻辑）

---

### Task 4: 新增 Glob 展开相关测试

**验收标准**:

- [ ] 测试 `ls *.ts` 模式展开
- [ ] 测试 `ls src/**/*.js` 多层 glob
- [ ] 测试无匹配时的行为
- [ ] 测试普通文件名不受影响

**TDD 步骤**:

- RED: 编写上述测试用例
- GREEN: 实现通过
- REFACTOR: 无需重构

**文件**: `src/agent/tools/run_command.test.ts`

**Estimated scope**: S（添加测试用例）

---

### Task 5: 新增 Allowlist 扩展命令测试

**验收标准**:

- [ ] 测试 `vim` 命令可执行（通过 mock）
- [ ] 测试 `ssh` 命令可执行
- [ ] 测试 `hg` 命令可执行
- [ ] 测试这些命令通过 `execFile` 而非 `exec`

**TDD 步骤**:

- RED: 编写测试验证新命令通过 allowlist 检查
- GREEN: 命令已在 Task 1 添加到 allowlist，测试通过
- REFACTOR: 无需重构

**文件**: `src/agent/tools/run_command.test.ts`

**Estimated scope**: S（添加测试用例）

---

## 验证检查点

### Checkpoint: After Tasks 1-5

- [ ] `bun run test:run src/agent/tools/run_command.test.ts` 全部通过
- [ ] `bun run typecheck` 类型检查通过
- [ ] 无 lint 错误
- [ ] 现有测试（blocklist, exec/execFile 路径）仍然通过

## 实现顺序

1. **Task 1**: 扩展 allowlist（基础，无需测试先行）
2. **Task 2**: 实现 glob 辅助函数（TDD）
3. **Task 3**: 集成 glob 展开（TDD）
4. **Task 4**: 新增 glob 测试
5. **Task 5**: 新增 allowlist 扩展测试

## 风险与缓解

| 风险                 | 影响 | 缓解                                         |
| -------------------- | ---- | -------------------------------------------- |
| `glob` 库引入失败    | 低   | Node.js 内置 `fs.globSync` 或 `node:fs.glob` |
| Glob 展开性能问题    | 低   | 同步调用，文件少时无感                       |
| 新命令引入新安全问题 | 中   | 审查每个新命令，确保无 shell features        |

## Open Questions

1. Glob 无匹配时：返回空结果还是报错？（暂定：返回空列表，command 执行返回空输出）
2. `hg` (Mercurial) 是否确实需要？（提案中提到，保留）
