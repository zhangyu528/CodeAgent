# 任务拆分：Session Manager Test Hardening

## 关联 SPEC

- **规格文档**：docs/ideas/specs/session-manager-test-hardening.md

## Idea 信息

- **文件**：docs/ideas/session-manager-test-hardening.md
- **Problem Statement**：`SessionManager` 测试中 15 个测试失败，因为测试尝试通过实例访问 `normalizeSessionRecord()` 和 `extractTitle()`，但它们是 `sessionService.ts` 的独立导出函数
- **MVP Scope**：
  1. 将 `normalizeSessionRecord()` 测试改为直接从 `sessionService.ts` 导入
  2. 将 `extractTitle()` 测试改为直接从 `sessionService.ts` 导入
  3. 验证全部 1021 测试通过

## 任务列表

### Task 1: 修复 normalizeSessionRecord() 测试

**验收标准**：

- `normalizeSessionRecord()` 测试不再通过 `(sessionManager as any)` 调用
- 测试直接从 `sessionService.ts` 导入 `normalizeSessionRecord`
- 8 个 `normalizeSessionRecord()` edge cases 测试全部通过

**TDD 步骤**：
- RED：运行 `bun run test:run -- tests/unit/agent/sessions.test.ts` 确认 8 个测试失败
- GREEN：修改测试文件，将 `normalizeSessionRecord` 测试改为从 `sessionService` 导入
- REFACTOR：验证所有测试通过

**文件**：`tests/unit/agent/sessions.test.ts`

### Task 2: 修复 extractTitle() 测试

**验收标准**：

- `extractTitle()` 测试不再通过 `(sessionManager as any)` 调用
- 测试直接从 `sessionService.ts` 导入 `extractTitle`
- 7 个 `extractTitle()` edge cases 测试全部通过

**TDD 步骤**：
- RED：运行测试确认 7 个测试失败
- GREEN：修改测试文件，从 `sessionService.ts` 导入 `extractTitle`
- REFACTOR：验证所有测试通过

**文件**：`tests/unit/agent/sessions.test.ts`

### Task 3: 验证完整测试套件通过

**验收标准**：

- `bun run test:run` 全部 1021 测试通过
- 无任何测试文件失败

**TDD 步骤**：
- 运行完整测试套件
- 确认无失败

**文件**：`tests/unit/agent/sessions.test.ts`
