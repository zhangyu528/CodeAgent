# SPEC: Zod-Driven Type Narrowing for Zustand Stores

## Objective

为 CodeAgent 的 Zustand store 和 React 组件引入 Zod schema 驱动的类型收窄机制，实现**编译时类型安全 + 运行时验证**双重保障。

当前状态：`tsconfig.json` 已启用 `strict: true`，现有 5 个 TS 编译错误（与本提案目标区域部分重叠）。本提案建立 Zod schema 作为 store 状态的单一真实来源，通过 `z.infer<>` 派生 TypeScript 类型，消除 `any` 类型的使用。

**MVP 范围**：

- 创建 `src/apps/cli/ink/store/schemas.ts` — 集中管理所有 store schema
- 为 `chatStore` 和 `messageStore` 定义 Zod schema
- 使用 `z.infer<>` 替换原有的 TypeScript 接口定义
- 在关键 store actions 中添加运行时 Zod 验证
- 消除这两个 store 文件中的类型错误

**用户**：CodeAgent CLI 开发者，解决 TypeScript 类型安全问题

## Tech Stack

- **框架**：Zustand 5（已安装）
- **语言**：TypeScript 5.x，`strict: true` 已启用
- **Schema 库**：Zod 4.3.6（已安装）
- **构建工具**：Bun（已配置）

## Commands

```
Build: npm run build
Test: bun run test:run
Dev: npm run dev
Type Check: bun run tsc --noEmit
```

## Project Structure

```
src/apps/cli/ink/store/
├── schemas.ts          ← [新建] 集中管理所有 Zod schemas
├── chatStore.ts        ← [修改] 使用 z.infer<> 收窄类型
├── messageStore.ts     ← [修改] 使用 z.infer<> 收窄类型
├── sessionStore.ts     ← [暂不修改] 保持现状
├── uiStore.ts          ← [暂不修改] 保持现状
└── index.ts            ← [修改] 导出 schemas
```

## Code Style

### Schema 定义规范

```typescript
// schemas.ts
import { z } from 'zod';

// 使用 Zod schema 作为单一类型来源
export const ChatMessageBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string() }),
  z.object({ kind: z.literal('thinking'), text: z.string(), collapsed: z.boolean().optional() }),
  z.object({ kind: z.literal('reasoning'), text: z.string(), collapsed: z.boolean().optional() }),
  z.object({ kind: z.literal('toolSummary'), text: z.string(), collapsed: z.boolean().optional() }),
]);

export type ChatMessageBlock = z.infer<typeof ChatMessageBlockSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'error']),
  title: z.string(),
  createdAt: z.number(),
  status: z.enum(['streaming', 'completed', 'error']).optional(),
  blocks: z.array(ChatMessageBlockSchema),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
```

### Store 类型收窄规范

```typescript
// chatStore.ts — 使用 z.infer<> 替代 interface
import { create } from 'zustand';
import { ChatMessageSchema, type ChatMessage } from './schemas.js';

interface ChatStore {
  messages: ChatMessage[];
  // ...
}
```

### 运行时验证规范

```typescript
// 在 setState actions 中添加验证
addMessage: (msg: unknown) => set((state) => {
  const result = ChatMessageSchema.safeParse(msg);
  if (!result.success) {
    console.error('[ChatStore] Invalid message:', result.error.format());
    return state;
  }
  return { messages: [...state.messages, result.data] };
}),
```

## Testing Strategy

- **框架**：Vitest（已配置）
- **测试位置**：`src/apps/cli/ink/store/` 目录下
- **覆盖率要求**：schemas.ts 100%，关键 actions 80%+
- **测试文件**：`schemas.test.ts`

```typescript
// schemas.test.ts
import { describe, it, expect } from 'vitest';
import { ChatMessageSchema, ChatMessageBlockSchema } from './schemas.js';

describe('ChatMessageBlockSchema', () => {
  it('parses valid text block', () => {
    const result = ChatMessageSchema.safeParse({
      id: '1',
      role: 'user',
      title: 'Test',
      createdAt: Date.now(),
      blocks: [{ kind: 'text', text: 'hello' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = ChatMessageSchema.safeParse({
      id: '1',
      role: 'invalid_role',
      title: 'Test',
      createdAt: Date.now(),
      blocks: [],
    });
    expect(result.success).toBe(false);
  });
});
```

## Boundaries

- **Always**：
  - 新建 store 必须同时创建对应的 Zod schema
  - Schema 定义放在 `schemas.ts` 中集中管理
  - 使用 `safeParse` 而非 `parse` 避免 throws
  - 运行 `bun run tsc --noEmit` 确认无新增错误

- **Ask first**：
  - 修改现有 store 的状态结构
  - 添加新的 store 文件
  - 更改 TypeScript strict 模式配置

- **Never**：
  - 在 store 中使用 `any` 类型
  - 使用 `as` 类型断言绕过类型检查
  - 删除已有的类型测试

## Success Criteria

1. `src/apps/cli/ink/store/schemas.ts` 创建完成，包含 `ChatMessageSchema`、`ChatMessageBlockSchema`、`ChatSessionInfoSchema`
2. `chatStore.ts` 使用 `z.infer<>` 收窄类型，原有 TypeScript 接口移除
3. `messageStore.ts` 使用 `z.infer<>` 收窄类型，原有 TypeScript 接口移除
4. `schemas.test.ts` 创建，测试覆盖所有 schema
5. `bun run tsc --noEmit` 在修改后的文件上无新增错误
6. `bun run test:run` 全部测试通过
7. `git diff` 显示只修改了预期的文件

## Open Questions

1. **partial updates**：Zustand 的 `setState` 支持部分更新，但 Zod schema 通常需要完整对象。如何在 `updateMessage` 等 partial update actions 中处理？
   → 方案：使用 `ChatMessageSchema.partial().safeParse()` 或维护两个 schema（完整版 + partial 版）

2. **Zustand 5 兼容性**：Zustand 5 官方尚未发布，但项目已使用。需确认 `strict: true` 与 Zustand 的兼容性。
   → 当前 `tsconfig.json` 已启用 `strict: true`，需验证

3. **CI 检查**：是否在 CI 中强制 `tsc --noEmit` 通过？
   → 建议添加，但需确保现有 5 个 TS 错误不影响本提案验收
