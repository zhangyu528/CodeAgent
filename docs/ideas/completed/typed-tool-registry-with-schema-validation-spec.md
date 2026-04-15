# SPEC: Typed Tool Registry with Schema Validation

## ASSUMPTIONS I'M MAKING:

1. `AgentTool<any>` 来自 `@mariozechner/pi-agent-core`，包含 `name`、`parameters`（Zod schema）、`execute` 函数
2. `pi-agent-core` 的 `validateToolArguments()` 函数接受 `AgentTool` 并使用其 `parameters` schema 进行验证
3. 现有工具的 `parameters` 字段已经是 `z.ZodType` 实例
4. 启动验证失败应抛出异常阻止应用启动，而非静默降级
5. 工具注册发生在 Agent 初始化阶段，不影响运行时动态注册

→ Correct me now or I'll proceed with these.

## Objective

为 CodeAgent 的工具系统建立类型化的 `ToolDefinition` 标准接口和验证注册表，解决以下问题：

1. **工具元数据不一致** — 无统一描述、示例、返回类型文档标准
2. **无验证管道** — schema 定义后从不按共享契约验证
3. **发现摩擦** — agent 无法一致地自省工具能力
4. **测试困难** — 每个工具必须单独测试

## Tech Stack

- **语言**: TypeScript（已在项目中使用）
- **验证**: Zod 4.x（已在 `src/agent/tools/` 中使用）
- **测试**: Vitest（项目已有测试框架）
- **构建**: Bun（项目的 JS runtime）

## Commands

```bash
构建: npm run build
测试: bun run test:run
开发: npm run dev
```

## Project Structure

```
src/agent/tools/
├── schema.ts              # NEW: ToolDefinitionSchema + ToolDefinition 类型
├── registry.ts            # NEW: ToolRegistry 类
├── index.ts               # MODIFY: 替换 allTools 数组为 registry 聚合
├── read_file.ts           # MODIFY: 符合 ToolDefinition
├── write_file.ts          # MODIFY: 符合 ToolDefinition
├── run_command.ts         # MODIFY: 符合 ToolDefinition
├── list_directory.ts      # MODIFY: 符合 ToolDefinition
├── search_files.ts        # MODIFY: 符合 ToolDefinition
└── __tests__/
    └── registry.test.ts   # NEW: ToolRegistry 单元测试
```

## Code Style

### ToolDefinitionSchema（新增）

```typescript
import { z } from 'zod';

export const ToolDefinitionSchema = z.object({
  name: z.string().describe('唯一工具标识符 (snake_case)'),
  label: z.string().describe('人类可读的操作标签，用于 UI'),
  description: z.string().describe('工具功能描述，一段以内'),
  category: z.enum(['file', 'terminal', 'web', 'code', 'system']).describe('工具分类'),
  parameters: z.instanceof(z.ZodType).describe('工具参数的 Zod schema'),
  examples: z.array(z.object({
    input: z.record(z.string(), z.unknown()),
    description: z.string(),
  })).optional().describe('供 agent 使用的示例'),
  deprecationReason: z.string().optional().describe('如果设置，工具已弃用'),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
```

### ToolRegistry 类（新增）

```typescript
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): void {
    const result = ToolDefinitionSchema.safeParse(def);
    if (!result.success) {
      throw new Error(`Invalid tool definition for "${def.name}": ${result.error.message}`);
    }
    this.tools.set(def.name, def);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(category?: string): ToolDefinition[] {
    const all = [...this.tools.values()];
    if (category) return all.filter(t => t.category === category);
    return all;
  }

  introspect(): { tools: ToolDefinition[]; categories: string[] } {
    return {
      tools: [...this.tools.values()],
      categories: [...new Set([...this.tools.values()].map(t => t.category))],
    };
  }
}
```

### 现有工具改造示例（read_file.ts）

```typescript
// BEFORE
export const readFileTool = {
  name: 'read_file',
  label: 'Reading File',           // 已有
  description: '...',
  parameters: z.object({...}),
  execute: async (...) => {...},
};

// AFTER — 导出 ToolDefinition 而非普通对象
export const readFileToolDefinition: ToolDefinition = {
  name: 'read_file',
  label: 'Reading File',
  description: '读取文件内容，最大文件大小 5MB。',
  category: 'file',
  parameters: z.object({
    filePath: z.string().describe('要读取的文件路径。'),
  }),
  examples: [
    {
      input: { filePath: '/home/user/project/README.md' },
      description: '读取项目 README 文件',
    },
  ],
};

export const readFileTool: AgentTool<any> = {
  ...readFileToolDefinition,
  execute: async (toolCallId, { filePath }, signal?, onChunk?) => {
    // 原有 execute 实现
  },
};
```

## Testing Strategy

### 测试框架

- **框架**: Vitest（项目已有）
- **测试位置**: `src/agent/tools/__tests__/registry.test.ts`

### 测试用例

1. **ToolRegistry.register()**
   - ✅ 有效 ToolDefinition 注册成功
   - ❌ 无效 schema 抛出 DescriptiveError
   - ❌ 重复注册同名工具抛出错误

2. **ToolRegistry.get()**
   - ✅ 已注册工具可按名称获取
   - ✅ 不存在的工具返回 undefined

3. **ToolRegistry.list()**
   - ✅ 不带参数返回全部工具
   - ✅ 带 category 过滤返回对应分类工具

4. **ToolRegistry.introspect()**
   - ✅ 返回所有工具和分类列表

5. **Startup validation**
   - ✅ registry 实例化时验证所有内置工具
   - ✅ 无效工具定义阻止启动（抛出异常）

### 覆盖率要求

- ToolRegistry: 100% 分支覆盖
- 新增 schema: 100%

## Boundaries

### Always（必须做）

- 所有工具必须导出符合 `ToolDefinitionSchema` 的对象
- 新工具必须通过 registry 验证才能注册
- examples 字段使用 `z.record(z.string(), z.unknown())` 而非泛型 object

### Ask first（需要先询问）

- 修改现有工具的 `name` 字段（影响 agent 调用）
- 修改 `category` 枚举值（影响工具分类体系）
- 移除已注册工具（检查是否有依赖）

### Never（绝不能做）

- 直接修改 `tools/index.ts` 中的工具数组而不通过 registry
- 跳过 registry 验证直接操作 Map
- 在 MVP 中引入动态插件加载（scope creep）

## Success Criteria

1. ✅ `ToolDefinitionSchema` 定义于 `src/agent/tools/schema.ts`
2. ✅ `ToolRegistry` 类实现于 `src/agent/tools/registry.ts`
3. ✅ 5 个现有工具（read_file, write_file, run_command, list_directory, search_files）符合 ToolDefinition
4. ✅ `tools/index.ts` 使用 `ToolRegistry` 替代静态 `allTools` 数组
5. ✅ 启动时 registry 验证所有工具定义，无效定义抛出异常
6. ✅ `read_file` 和 `run_command` 包含 `examples` 字段
7. ✅ `registry.test.ts` 覆盖 register/get/list/introspect 所有路径
8. ✅ `bun run test:run` 全部通过

## Open Questions

1. **`parameters` 类型**: 使用 `z.instanceof(z.ZodType)` 在运行时有效，但 TypeScript 类型推断较弱。替代方案：使用 `z.custom()` 或存储 JSON schema。MVP 采用 `instanceof` 因为与现有 pi-agent-core 兼容。
2. **examples 使用场景**: MVP 中 examples 仅用于文档。运行时 few-shot 提示词为 v2 范围。
3. **pi-agent-core 对齐**: `AgentTool` 接口的 `parameters: z.ZodType` 与 `ToolDefinition.parameters: z.instanceof(z.ZodType)` 兼容。
