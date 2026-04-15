# 任务拆分：Typed Tool Registry with Schema Validation

## 关联 SPEC

- **规格文档**：`docs/ideas/todo/typed-tool-registry-with-schema-validation-spec.md`

## Idea 信息

- **文件**：`docs/ideas/todo/typed-tool-registry-with-schema-validation.md`
- **Problem Statement**：CodeAgent 工具系统无类型化 ToolDefinition 标准，schema 无验证管道，工具元数据不一致
- **MVP Scope**：
  1. 定义 `ToolDefinitionSchema` + `ToolDefinition` 类型
  2. 实现 `ToolRegistry` 类（启动验证）
  3. 改造 5 个现有工具符合 ToolDefinition
  4. `tools/index.ts` 使用 registry 聚合
  5. 为 read_file 和 run_command 添加 examples
  6. 单元测试覆盖

## ASSUMPTIONS I'M MAKING:

1. 现有工具的 `parameters` 字段是 Zod schema 实例（`z.object({...})`），不是 `z.ZodType`
2. `AgentTool<any>` 的 `execute` 签名兼容现有工具：`execute(toolCallId, args, signal?, onChunk?)`
3. 测试目录为 `src/agent/tools/__tests__/`（需创建）
4. 启动验证在 `ToolRegistry` 构造时同步进行

→ Correct me now or I'll proceed with these.

## 任务列表

### Task 1: 创建 ToolDefinitionSchema（src/agent/tools/schema.ts）

**验收标准**：
- [ ] `ToolDefinitionSchema` 使用 Zod 定义，包含 name/label/description/category/parameters/examples/deprecationReason 字段
- [ ] `ToolDefinition` 类型通过 `z.infer` 导出
- [ ] `ToolCategory` 枚举类型单独导出：`'file' | 'terminal' | 'web' | 'code' | 'system'`
- [ ] `ToolExample` 接口类型单独导出

**TDD 步骤**：
- RED：写测试验证 schema 导出正确
- GREEN：创建 schema.ts，导出所需类型
- REFACTOR：无

**文件**：`src/agent/tools/schema.ts`（新建）

**Estimated scope**: XS（1个新文件，2-3个类型定义）

---

### Task 2: 创建 ToolRegistry 类（src/agent/tools/registry.ts）

**验收标准**：
- [ ] `ToolRegistry` 类实现 `register(def: ToolDefinition): void`
- [ ] 注册时使用 `ToolDefinitionSchema.safeParse()` 验证，失败抛出 `Error`（包含工具名和 Zod 错误信息）
- [ ] `get(name: string): ToolDefinition | undefined`
- [ ] `list(category?: ToolCategory): ToolDefinition[]`
- [ ] `introspect(): { tools: ToolDefinition[]; categories: string[] }`

**TDD 步骤**：
- RED：写测试覆盖 register/get/list/introspect 所有路径
- GREEN：实现 registry.ts
- REFACTOR：无

**文件**：`src/agent/tools/__tests__/registry.test.ts`（新建测试）、`src/agent/tools/registry.ts`（新建）

**Estimated scope**: S（2个新文件）

---

### Task 3: 改造 read_file 工具符合 ToolDefinition

**验收标准**：
- [ ] `read_file.ts` 导出 `readFileToolDefinition: ToolDefinition`
- [ ] `readFileToolDefinition.parameters` 为 `z.object({...})` 形式
- [ ] `readFileToolDefinition` 包含 `examples` 字段（至少1个示例）
- [ ] `readFileToolDefinition.category` 为 `'file'`
- [ ] `readFileTool`（AgentTool）同时导出，保持原有 execute 实现不变

**TDD 步骤**：
- RED：写测试验证 `readFileToolDefinition` 符合 ToolDefinitionSchema
- GREEN：在 read_file.ts 中添加 `readFileToolDefinition` 导出
- REFACTOR：无

**文件**：`src/agent/tools/read_file.ts`

**Estimated scope**: S（1个文件修改）

---

### Task 4: 改造 run_command 工具符合 ToolDefinition

**验收标准**：
- [ ] `run_command.ts` 导出 `runCommandToolDefinition: ToolDefinition`
- [ ] `runCommandToolDefinition.parameters` 为 `z.object({...})` 形式
- [ ] `runCommandToolDefinition` 包含 `examples` 字段（至少1个示例）
- [ ] `runCommandToolDefinition.category` 为 `'terminal'`
- [ ] `runCommandTool`（AgentTool）同时导出，保持原有 execute 实现不变

**TDD 步骤**：
- RED：写测试验证 `runCommandToolDefinition` 符合 ToolDefinitionSchema
- GREEN：在 run_command.ts 中添加 `runCommandToolDefinition` 导出
- REFACTOR：无

**文件**：`src/agent/tools/run_command.ts`

**Estimated scope**: S（1个文件修改）

---

### Task 5: 改造 write_file / list_directory / search_files 工具符合 ToolDefinition

**验收标准**：
- [ ] `write_file.ts` 导出 `writeFileToolDefinition: ToolDefinition`，category 为 `'file'`
- [ ] `list_directory.ts` 导出 `listDirectoryToolDefinition: ToolDefinition`，category 为 `'file'`
- [ ] `search_files.ts` 导出 `searchFilesToolDefinition: ToolDefinition`，category 为 `'file'`
- [ ] 所有 definition 包含 `description` 字段（非空）
- [ ] 所有 AgentTool 导出保持不变

**TDD 步骤**：
- RED：写测试验证所有 definition 符合 ToolDefinitionSchema
- GREEN：在各工具文件中添加 definition 导出
- REFACTOR：无

**文件**：`src/agent/tools/write_file.ts`、`src/agent/tools/list_directory.ts`、`src/agent/tools/search_files.ts`

**Estimated scope**: S（3个文件修改）

---

### Task 6: 改造 tools/index.ts 使用 ToolRegistry

**验收标准**：
- [ ] `tools/index.ts` 导入 `ToolRegistry` 和所有工具 definition
- [ ] 创建 `toolRegistry` 实例，在模块级别注册所有工具
- [ ] 导出 `toolRegistry` 实例
- [ ] 替换 `allTools` 数组为从 registry 获取：`allTools: AgentTool<any>[] = toolRegistry.list().map(...)`
- [ ] 应用启动时 registry 验证所有工具定义（如果无效，抛出异常阻止启动）

**TDD 步骤**：
- RED：写测试验证 tools/index.ts 导出 toolRegistry 且 allTools 来自 registry
- GREEN：重写 tools/index.ts 使用 registry
- REFACTOR：无

**文件**：`src/agent/tools/index.ts`

**Estimated scope**: S（1个文件修改）

---

### Task 7: 运行测试验证

**验收标准**：
- [ ] `bun run test:run` 所有测试通过
- [ ] `npm run build` 构建成功（无 TypeScript 错误）

**TDD 步骤**：
- RED：（此步骤即验证）
- GREEN：（无需实现代码）
- REFACTOR：如需要，修复类型不匹配

**文件**：所有修改的文件

**Estimated scope**: S（验证步骤）

---

## Checkpoint: 完成后验证

- [ ] 所有 Task 验收标准达成
- [ ] `bun run test:run` 通过
- [ ] `npm run build` 成功
- [ ] Registry 启动验证逻辑已测试

## 任务依赖关系

```
Task 1 (schema.ts) ──┐
                      ├── Task 2 (registry.ts) ──> Task 6 (index.ts)
Task 3 (read_file)  ─┤
Task 4 (run_command) ─┤
Task 5 (write/list/search) ──┴──> Task 7 (verify)
```

Task 1, 3, 4, 5 可并行开发（各自独立），但均需 Task 1 schema 就绪后进行。
