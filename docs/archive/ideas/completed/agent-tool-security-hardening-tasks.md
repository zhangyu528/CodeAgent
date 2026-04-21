# 任务拆分：Agent Tool Security Hardening

## 关联 SPEC

- **规格文档**：docs/ideas/todo/agent-tool-security-hardening-spec.md

## Idea 信息

- **文件**：docs/ideas/todo/agent-tool-security-hardening.md
- **Problem Statement**：三个关键安全漏洞：shell 注入绕过（execFile 未显式设置 shell:false）、Session ID 路径遍历（需验证接入）、无界资源消耗（MAX_FILES=5000 需确认有效）
- **MVP Scope**：确认并显式化三个安全修复，确保现有测试通过

## 任务列表

### Task 1: 显式设置 execFile shell:false

**验收标准**：

- [ ] `run_command.ts` 中所有 `execFile()` 调用显式设置 `{ shell: false }`
- [ ] 有 shell metacharacter 的命令继续使用 `exec()` with `shell: true`

**TDD 步骤**：RED（测试）→ GREEN（实现）→ REFACTOR
**文件**：`src/agent/tools/run_command.ts`

### Task 2: 验证 Session ID 验证接入

**验收标准**：

- [ ] `sessions.ts` 中 `isValidSessionId()` 在所有公共方法中正确调用
- [ ] `sessionRepository.ts` 中 `isValidSessionId()` 在所有公共方法中正确调用
- [ ] 测试验证 `../` 被拒绝

**TDD 步骤**：RED（测试）→ GREEN（实现）→ REFACTOR
**文件**：`src/agent/sessions.ts`、`src/agent/sessionRepository.ts`、`src/agent/sessionUtils.ts`

### Task 3: 验证文件搜索资源限制

**验收标准**：

- [ ] `search_files.ts` 中 `MAX_FILES = 5000` 存在且有效
- [ ] `MAX_DEPTH = 20` 存在且有效
- [ ] 当达到任一限制时搜索正确中止

**TDD 步骤**：RED（测试）→ GREEN（实现）→ REFACTOR
**文件**：`src/agent/tools/search_files.ts`

### Task 4: 运行完整测试套件

**验收标准**：

- [ ] `bun run test:run` 全部通过
- [ ] 无回归

**TDD 步骤**：直接运行测试套件
**文件**：全部

---

## 执行顺序

1. Task 1 → 2 → 3 可以并行（各自独立）
2. Task 4 在所有任务完成后执行（验证无回归）
3. Checkpoint：所有任务通过后 → Step 5 发送开始报告
