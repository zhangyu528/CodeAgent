# 任务拆分：Session Index Cache

## 关联 SPEC

- **规格文档**：docs/ideas/specs/session-index-cache.md

## Idea 信息

- **文件**：docs/ideas/todo/session-index-cache.md
- **Problem Statement**：getHistory() 对每个 session 文件执行 O(N) fs.stat，导致 100+ 会话时 UI 阻塞
- **MVP Scope**：5 项核心任务，无额外依赖

## 任务列表

### Task 1: 添加索引文件读写工具函数

**验收标准**：

- [ ] `readIndex()` 能够读取 `sessions/index.json`（文件不存在时返回空索引）
- [ ] `readIndex()` 能够处理 JSON 解析失败的情况（返回空索引，不崩溃）
- [ ] `updateIndex()` 能够新增、更新、删除索引条目
- [ ] 索引始终按 `mtimeMs` 降序排列

**TDD 步骤**：RED → GREEN → REFACTOR

**文件**：`src/agent/sessionIndexCache.ts`（新建）

### Task 2: 在 JsonSessionRepository.save() 中集成索引更新

**验收标准**：

- [ ] 每次调用 `save()` 后，`index.json` 中对应条目已更新
- [ ] 新建 session 时，索引中新增条目
- [ ] 更新现有 session 时，索引中对应条目 mtimeMs 更新
- [ ] 索引更新失败时不影响 session 本身保存（降级）

**TDD 步骤**：RED → GREEN → REFACTOR

**文件**：`src/agent/sessionRepository.ts`

### Task 3: 在 JsonSessionRepository.list() 中使用索引

**验收标准**：

- [ ] `list(limit)` 直接从 `index.json` 读取，按 mtime 降序返回
- [ ] 索引不存在或损坏时，降级到逐文件读取旧逻辑
- [ ] 返回的 `SessionMeta[]` 结构与原来完全一致
- [ ] 100 个会话时 list() 响应时间 < 100ms

**TDD 步骤**：RED → GREEN → REFACTOR

**文件**：`src/agent/sessionRepository.ts`

### Task 4: SessionManager 委托到 JsonSessionRepository（消除重复代码）

**验收标准**：

- [ ] `SessionManager.getHistory()` 委托给 `sessionRepository.list()`
- [ ] `SessionManager.saveSession()` 委托给 `sessionRepository.save()`
- [ ] 原有 `SessionManager` 的 `getHistory` 重复逻辑被移除
- [ ] 两者的 `getHistory` / `list` 行为完全一致

**TDD 步骤**：RED → GREEN → REFACTOR

**文件**：`src/agent/sessions.ts`

### Task 5: 添加索引迁移逻辑（启动时重建索引）

**验收标准**：

- [ ] 启动时若 `index.json` 不存在，自动从现有 session 文件重建
- [ ] 启动时若 `index.json` 中某个 session 文件不存在（已删除），从索引中移除
- [ ] 迁移过程不影响正常启动（异步执行或延迟加载）
- [ ] 迁移完成后 `list()` 行为与迁移前一致

**TDD 步骤**：RED → GREEN → REFACTOR

**文件**：`src/agent/sessionRepository.ts`

---

## 实现顺序

1. Task 1（基础）→ Task 2（集成保存）→ Task 3（列表查询）→ Task 4（去重）→ Task 5（迁移）
2. Task 1 是基础，Task 2-3 依赖 Task 1
3. Task 4 是清理工作，可在 Task 3 完成后进行
4. Task 5 是保障机制，可在最后添加

## 依赖关系

```
Task 1: readIndex/writeIndex 工具
    ├── Task 2: save() 集成（依赖 Task 1）
    └── Task 3: list() 集成（依赖 Task 1）
            └── Task 4: SessionManager 委托（依赖 Task 3）
                    └── Task 5: 迁移逻辑（依赖 Task 2+3）
```
