# 任务拆分：Agent Tool Security Hardening

## Idea 信息
- **文件**：docs/ideas/agent-tool-security-hardening.md
- **Problem Statement**：CodeAgent 工具执行层存在三个关键安全漏洞：(1) Shell 命令注入绕过，(2) Session ID 路径遍历，(3) 无界资源消耗
- **MVP Scope**：实现三阶段安全修复并验证：Shell 命令正确执行、元字符注入被阻止、无效 Session ID 被拒绝、searchFilesTool 在 5000 文件后中止、所有现有测试通过

## 任务列表

### Task 1: 创建安全验证共享模块 `src/agent/tools/security.ts`

**验收标准**：
- [ ] `validatePath(path: string, workspaceRoot: string): string | null` — 返回规范化路径或超出工作区时返回 null
- [ ] `validateSessionId(id: string): boolean` — 验证 session ID 仅包含 `a-zA-Z0-9_-`，长度 ≤ 255
- [ ] `checkCommandAllowed(cmd: string): { allowed: boolean; reason?: string }` — 命令允许检查
- [ ] 所有文件/命令工具可从 `security.ts` 导入验证函数

**TDD 步骤**：
- RED：编写 `security.test.ts`，测试路径遍历拒绝、Session ID 无效格式拒绝
- GREEN：实现 `security.ts` 中的验证函数
- REFACTOR：如需要，提取公共常量

**文件**：`src/agent/tools/security.ts`, `src/agent/tools/security.test.ts`

**估算规模**：S（1-2 文件）

---

### Task 2: 实现 Phase 2 — Session ID 验证（已在 sessions.ts 中实现）

**验收标准**：
- [ ] `sessions.ts` 中的 `isValidSessionId()` 函数已存在（已实现）
- [ ] `sessionRepository.ts` 中的 session ID 验证已正确调用
- [ ] 路径遍历攻击的 session ID（如 `../../../etc`）被拒绝

**TDD 步骤**：
- RED：编写测试，验证包含 `../` 的 session ID 被拒绝
- GREEN：确认现有 `SESSION_ID_REGEX` 实现已覆盖
- REFACTOR：如需要，增强错误消息

**文件**：`src/agent/sessions.ts`, `src/agent/sessionRepository.ts`

**估算规模**：XS（1 文件）

**注意**：此任务在 `sessions.ts` 中已有实现，仅需确认测试覆盖。

---

### Task 3: 实现 Phase 1 — Shell 命令安全强化（Part A: 修复 allowlist 正则）

**验收标准**：
- [ ] `ALLOWED_REGEX` 覆盖所有必需命令：`git`, `npm`, `bun`, `node`, `python`, `pip`, `cargo`, `go`
- [ ] 非 allowlist 命令无 shell 元字符时，应使用 `execFile` 并拒绝（而非静默 fallback）
- [ ] 测试：`echo hello` 不带 shell 元字符时正确执行

**TDD 步骤**：
- RED：编写测试，验证未知命令（无 shell 元字符）被拒绝
- GREEN：修改 `run_command.ts` 中第 169-193 行的 fallback 逻辑，改为拒绝未知命令
- REFACTOR：保持与现有 `ALLOWED_REGEX` 的一致性

**文件**：`src/agent/tools/run_command.ts`, `src/agent/tools/run_command.test.ts`

**估算规模**：M（2-3 文件，涉及安全逻辑）

---

### Task 4: 实现 Phase 1 — Shell 命令安全强化（Part B: 增强元字符处理）

**验收标准**：
- [ ] 带有 shell 元字符的非 allowlist 命令被拒绝（而非直接执行）
- [ ] 带有 shell 元字符的 allowlist 命令通过 `exec()` 执行但经过 blocklist 检查
- [ ] `BLOCKED_REGEX` 覆盖 `sudo`, `su`, `chmod 777`, `chown`, `dd` 等权限提升模式

**TDD 步骤**：
- RED：编写测试，验证 `sudo npm install` 被 blocklist 阻止
- GREEN：更新 `BLOCKED_REGEX` 包含权限提升模式
- REFACTOR：更新注释说明安全模型

**文件**：`src/agent/tools/run_command.ts`

**估算规模**：S（1 文件，正则修改）

---

### Task 5: 实现 Phase 3 — 资源边界限制

**验收标准**：
- [ ] `searchFilesTool` 在扫描 `MAX_FILES` (5000) 文件后中止
- [ ] `getHistory` 在 `sessionRepository.ts` 中需要 `limit` 参数（无无界查询）
- [ ] `list_directory.ts` 无需额外资源限制（已限制于 workspace）

**TDD 步骤**：
- RED：编写测试，验证 `searchFilesTool` 在 5000 文件后停止扫描
- GREEN：确认 `search_files.ts` 第 114 行已实现 `filesScanned >= MAX_FILES` 检查
- REFACTOR：添加注释说明资源限制策略

**文件**：`src/agent/tools/search_files.ts`

**估算规模**：XS（确认现有实现）

---

### Task 6: 集成安全模块到工具层

**验收标准**：
- [ ] `list_directory.ts` 使用 `validatePath()` 进行路径验证
- [ ] `search_files.ts` 使用 `validatePath()` 进行路径验证
- [ ] 所有安全验证函数从 `security.ts` 集中导出

**TDD 步骤**：
- RED：编写集成测试，验证路径遍历在 `list_directory` 和 `search_files` 中被阻止
- GREEN：将现有内联路径验证重构为调用 `security.ts`
- REFACTOR：移除各工具中的重复验证代码

**文件**：`src/agent/tools/list_directory.ts`, `src/agent/tools/search_files.ts`, `src/agent/tools/security.ts`

**估算规模**：M（3-5 文件，重构）

---

### Task 7: 全量测试验证

**验收标准**：
- [ ] 运行 `bun run test:run`，所有测试通过
- [ ] 集成测试 `toolSecurity.test.ts` 全部通过
- [ ] 安全相关测试覆盖路径遍历、命令注入、会话 ID 验证

**TDD 步骤**：
- RED：运行测试，确认所有测试通过
- GREEN：无需修改（验证阶段）
- REFACTOR：如有任何失败，分析并修复

**文件**：所有相关测试文件

**估算规模**：S（测试运行和验证）

---

## 实施顺序

1. **Task 1**（Foundation: 安全共享模块）
2. **Task 2**（确认 Session ID 验证已有）
3. **Task 3**（Phase 1A: 修复 allowlist fallback）
4. **Task 4**（Phase 1B: 增强 blocklist）
5. **Task 5**（Phase 3: 资源边界确认）
6. **Task 6**（集成安全模块）
7. **Task 7**（全量测试验证）

## Checkpoint: 完成后
- [ ] 所有安全测试通过
- [ ] `run_command.ts` 移除了静默 fallback 行为
- [ ] Session ID 验证覆盖路径遍历
- [ ] `searchFilesTool` 有明确文件数上限
