# 任务拆分：Zod-Driven Type Narrowing for Zustand Stores

## 关联 SPEC

- **规格文档**：`docs/ideas/todo/zod-type-narrowing-integration-spec.md`

## Idea 信息

- **文件**：`docs/ideas/todo/zod-type-narrowing-integration.md`
- **Problem Statement**：CodeAgent 的 Zustand stores 使用 TypeScript plain interfaces，缺乏 Zod schema 验证，导致类型收窄不足，`any` 类型存在
- **MVP Scope**：聚焦 `chatStore` 和 `messageStore` 两个 store，建立 Zod schema 作为单一类型来源

## 任务列表

### Task 1: 创建 schemas.ts — Zod Schema 集中定义

**验收标准**：

- [ ] `src/apps/cli/ink/store/schemas.ts` 文件创建
- [ ] 包含 `ChatMessageBlockSchema`（使用 `z.discriminatedUnion`）
- [ ] 包含 `ChatMessageSchema`（基于 ChatMessageBlockSchema）
- [ ] 包含 `ChatSessionInfoSchema`
- [ ] 包含 `MessageStoreState` schema（messages, thinking, usage）
- [ ] 导出所有 schema 和对应的 `z.infer<>` 类型
- [ ] `bun run tsc --noEmit` 无新增错误

**TDD 步骤**：无测试先行，直接实现 schema 定义（基础架构任务）

**文件**：`src/apps/cli/ink/store/schemas.ts`

### Task 2: 重构 chatStore.ts — 使用 z.infer<> 类型收窄

**验收标准**：

- [ ] 导入并使用 `schemas.ts` 中的 schema 类型
- [ ] 移除原有的 TypeScript plain interface 中的 `ChatMessage` 类型定义
- [ ] `ChatStore` 接口的 `messages: ChatMessage[]` 使用 `z.infer<typeof ChatMessageSchema>`
- [ ] `addMessage` action 使用 `ChatMessageSchema.safeParse()` 验证输入
- [ ] `updateLastMessage` action 正确处理 `ChatMessage | undefined` 边界情况
- [ ] `bun run tsc --noEmit` 在 chatStore.ts 上无新增错误
- [ ] `bun run test:run` 全部测试通过

**TDD 步骤**：RED（修改后确认无新增错误）→ GREEN（修复出现的类型问题）→ REFACTOR

**文件**：`src/apps/cli/ink/store/chatStore.ts`

### Task 3: 重构 messageStore.ts — 使用 z.infer<> 类型收窄

**验收标准**：

- [ ] 导入并使用 `schemas.ts` 中的 schema 类型
- [ ] 移除原有的 TypeScript plain interface
- [ ] `MessageStore` 接口的 `messages: ChatMessage[]` 使用 `z.infer<typeof ChatMessageSchema>`
- [ ] `addMessage` action 使用 `ChatMessageSchema.safeParse()` 验证输入
- [ ] `bun run tsc --noEmit` 在 messageStore.ts 上无新增错误
- [ ] `bun run test:run` 全部测试通过

**TDD 步骤**：RED → GREEN → REFACTOR

**文件**：`src/apps/cli/ink/store/messageStore.ts`

### Task 4: 更新 store/index.ts — 导出 schemas

**验收标准**：

- [ ] `index.ts` 从 `schemas.ts` 导出所有 schema
- [ ] 其他 store 文件（sessionStore.ts, uiStore.ts）不受影响
- [ ] `bun run tsc --noEmit` 无新增错误

**文件**：`src/apps/cli/ink/store/index.ts`

### Task 5: 创建 schemas.test.ts — Schema 验证测试

**验收标准**：

- [ ] `src/apps/cli/ink/store/schemas.test.ts` 创建
- [ ] 测试 `ChatMessageBlockSchema` 对所有 kind 类型（text, thinking, reasoning, toolSummary）
- [ ] 测试 `ChatMessageSchema` 有效和无效输入
- [ ] 测试 `safeParse` 在无效数据时返回 `success: false`
- [ ] 测试 `z.infer<>` 派生的类型与手写类型行为一致
- [ ] `bun run test:run` schemas 相关测试全部通过

**TDD 步骤**：RED（先写测试验证 schema 行为）→ GREEN（确保测试通过）→ REFACTOR

**文件**：`src/apps/cli/ink/store/schemas.test.ts`

### Task 6: 最终验证 — 完整构建

**验收标准**：

- [ ] `bun run tsc --noEmit` 全部通过（0 errors）
- [ ] `bun run test:run` 全部测试通过
- [ ] `git diff --stat` 显示只修改了 `src/apps/cli/ink/store/` 目录下的文件
- [ ] `src/apps/cli/ink/store/schemas.ts` 包含所有 schema 定义

---

## 任务执行顺序

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
```

**依赖关系**：Task 1 是基础（schemas.ts），Task 2/3/4/5 都依赖它。Task 2 和 Task 3 可并行（独立 store），Task 4 在 2/3 完成后执行，Task 5 可与 Task 2/3/4 并行（schema 测试不依赖 store 实现细节）。

---

## 预估工作量

| 任务   | 预估复杂度 | 原因                               |
| ------ | ---------- | ---------------------------------- |
| Task 1 | S          | 纯新增文件，schema 定义            |
| Task 2 | M          | 修改现有 store，需小心处理类型边界 |
| Task 3 | S          | 小型 store（44行），修改量小       |
| Task 4 | XS         | 纯导出语句添加                     |
| Task 5 | S          | 测试文件，覆盖已知场景即可         |
| Task 6 | S          | 验证步骤                           |

**总体评估**：M（中等）— 聚焦两个 store，影响范围可控
