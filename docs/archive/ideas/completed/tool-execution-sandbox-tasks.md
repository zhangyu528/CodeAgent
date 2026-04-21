# 任务拆分：Tool Execution Sandbox

## 关联 SPEC

- **规格文档**：`docs/ideas/todo/tool-execution-sandbox-spec.md`

## Idea 信息

- **文件**：`docs/ideas/todo/tool-execution-sandbox.md`
- **Problem Statement**：安全检查分散在各个工具中，缺乏统一的 sandboxing API
- **MVP Scope**：构建 ToolExecutionContext 类，集成到现有工具

## 任务列表

### Task 1: 创建 ToolExecutionContext 类

**验收标准**：

- [ ] `src/agent/tools/sandbox/context.ts` 文件创建
- [ ] `ToolExecutionContext` 类实现 `exec()`, `validatePath()`, `readFile()`, `writeFile()` 方法
- [ ] `validatePath()` 复用 `security-patterns.ts` 的实现
- [ ] `exec()` 支持超时（timeout）、缓冲区限制（maxBuffer）、shell 隔离选项
- [ ] 导出到 `sandbox/index.ts`

**TDD 步骤**：RED → GREEN → REFACTOR
**文件**：`src/agent/tools/sandbox/context.ts`, `src/agent/tools/sandbox/index.ts`

### Task 2: 清理 run_command.ts Merge Conflict 并委托 sandbox

**验收标准**：

- [ ] `run_command.ts` 中的 `<<<<<<<`, `=======`, `>>>>>>>` merge conflict 标记全部清除
- [ ] 命令执行委托给 `sandbox.exec()`
- [ ] 保留原有的 permission ledger 集成（isApproved / approveCommand）
- [ ] 保留原有的超时和 maxBuffer 逻辑
- [ ] `bun run test:run` 中 `run_command.test.ts` 仍然通过

**TDD 步骤**：RED → GREEN → REFACTOR
**文件**：`src/agent/tools/run_command.ts`

### Task 3: 重构 write_file.ts 使用 sandbox context

**验收标准**：

- [ ] `writeFile()` 使用 `sandbox.validatePath()` 替代内联 `validatePath` 函数
- [ ] `getWorkspaceRoot()` 改为使用 `sandbox` 模块的导出
- [ ] 保留原有 trajectory 事件发射（emitToolCallStart/End/Error）
- [ ] 保留 MAX_CONTENT_SIZE 限制
- [ ] 所有测试通过

**TDD 步骤**：RED → GREEN → REFACTOR
**文件**：`src/agent/tools/write_file.ts`

### Task 4: 重构 search_files.ts 使用 sandbox context

**验收标准**：

- [ ] `searchFilesTool.execute()` 中 `validatePath()` 改为使用 `sandbox` 模块
- [ ] 保留原有的 `getWorkspaceRoot()` 函数（逻辑不变）
- [ ] 保留原有的 ReDoS 保护（safeRegexTest）
- [ ] 保留原有的 MAX_DEPTH / MAX_FILES 限制
- [ ] 所有测试通过

**TDD 步骤**：RED → GREEN → REFACTOR
**文件**：`src/agent/tools/search_files.ts`

### Task 5: 重构 read_file.ts 使用 sandbox context

**验收标准**：

- [ ] 新增 `validatePath()` 验证，调用 `sandbox` 模块
- [ ] 拒绝访问 workspace 外的路径（返回错误而非静默）
- [ ] 保留原有的文件大小限制（MAX_FILE_SIZE）
- [ ] 保留 trajectory 事件发射
- [ ] 新增单元测试覆盖路径越界场景

**TDD 步骤**：RED → GREEN → REFACTOR
**文件**：`src/agent/tools/read_file.ts`, `src/agent/tools/read_file.test.ts`（新建）

### Task 6: 创建 sandbox/context.test.ts 单元测试

**验收标准**：

- [ ] `validatePath()` 正确接受 workspace 内路径
- [ ] `validatePath()` 正确拒绝 workspace 外路径（`..`, `/etc/passwd` 等）
- [ ] `validatePath()` 正确处理 `~` 展开
- [ ] `exec()` 超时逻辑正确
- [ ] `exec()` maxBuffer 限制正确
- [ ] `exec()` 拒绝 BLOCKED_REGEX 模式命令

**TDD 步骤**：RED → GREEN → REFACTOR
**文件**：`src/agent/tools/sandbox/context.test.ts`（新建）

---

## 依赖关系

```
Task 1 (ToolExecutionContext) ← Task 2, Task 3, Task 4, Task 5 依赖
Task 2 (run_command)         ← Task 6 可并行
Task 3 (write_file)           ← Task 6 可并行
Task 4 (search_files)         ← Task 6 可并行
Task 5 (read_file)            ← Task 6 可并行
```

## Checkpoint（Task 1-3 完成后）

- [ ] `ToolExecutionContext` 类可用
- [ ] `run_command.ts` 清理完成，无 merge conflict 标记
- [ ] `write_file.ts` 使用 sandbox
- [ ] `bun run test:run` 全部通过

## Checkpoint（Task 4-6 完成后）

- [ ] `search_files.ts` 使用 sandbox
- [ ] `read_file.ts` 新增 workspace 验证
- [ ] `context.test.ts` 覆盖所有公开方法
- [ ] `bun run test:run` 全部通过
