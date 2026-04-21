# 任务拆分：pi-agent-core API Contract

## 关联 SPEC

- **规格文档**：`docs/ideas/todo/pi-agent-core-api-contract-spec.md`

## Idea 信息

- **文件**：`docs/ideas/todo/pi-agent-core-api-contract.md`
- **Problem Statement**：CodeAgent 依赖 `pi-agent-core` 和 `pi-ai`，使用 `^0.61.1` 允许任意 minor/patch 升级引入 breaking change，阻塞 N3/N4/N5 开发
- **MVP Scope**：
  1. `package.json` 锁定精确版本
  2. API surface 检查（`setModel`、`setTools`）
  3. `KNOWN_ISSUES` 注册表

## 任务列表

### Task 1: 锁定 package.json 精确版本

**验收标准**：

- `@mariozechner/pi-agent-core` 版本为 `0.61.1`（无 `^` 前缀）
- `@mariozechner/pi-ai` 版本为 `0.61.1`（无 `^` 前缀）

**TDD 步骤**：N/A（配置文件变更）

**文件**：

- `package.json`

### Task 2: 增强 compatibilityCheck.ts API surface 检查

**验收标准**：

- 新增 `verifyAgentAPIs()` 函数验证 `Agent.setModel` 和 `Agent.setTools` 方法存在
- `runCompatibilityCheck()` 调用 `verifyAgentAPIs()`
- `CompatibilityResult` 包含 API 检查结果

**TDD 步骤**：

- RED：现有测试应继续通过，新增 API 检查失败时抛出 `CompatibilityError`
- GREEN：实现 `verifyAgentAPIs()` 逻辑

**文件**：

- `src/agent/compatibilityCheck.ts`
- `tests/unit/agent/compatibilityCheck.test.ts`

### Task 3: 添加 KNOWN_ISSUES 注册表

**验收标准**：

- `KNOWN_ISSUES` 对象存在于 `compatibilityCheck.ts`
- 包含当前已知的 `pi-agent-core` 问题条目
- 兼容性问题时提示 workaround

**文件**：

- `src/agent/compatibilityCheck.ts`

### Task 4: 扩展 piAgentCoreContract 测试

**验收标准**：

- 新增测试验证 `Agent` 构造函数的 `getApiKey` 参数类型
- 新增测试验证 `Agent` 实例可调用 `setModel` 和 `setTools`
- 所有测试通过：`bun run test:run`

**TDD 步骤**：

- RED：新增测试失败（如果 API 不存在）
- GREEN：实现验证逻辑使测试通过

**文件**：

- `tests/unit/agent/piAgentCoreContract.test.ts`

### Task 5: 验证完整测试通过

**验收标准**：

- `bun run test:run` 全部通过
- `npx tsc --noEmit` 无错误
