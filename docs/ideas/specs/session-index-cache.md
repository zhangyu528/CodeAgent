# SPEC: Session Index Cache

## Objective

解决 `getHistory()` / `list()` 方法在 100+ 会话时 O(N) 文件读取的性能问题。通过在每次保存会话时更新 `sessions/index.json` 索引缓存，使 `getHistory()` 只需读取索引文件即可获取会话列表（按 mtime 排序），无需逐个读取完整的 session JSON 文件。

**用户故事**：当用户执行 `/history` 命令查看会话列表时，无论有多少会话，响应时间都应该保持在 100ms 以内，而不是随会话数量线性增长。

## Tech Stack

- **语言**：TypeScript（Node.js / Bun 运行时）
- **存储**：`sessions/index.json`（文件索引）+ `sessions/*.json`（现有 session 文件）
- **依赖**：Node.js 内置 `fs/promises`，无新增依赖
- **约束**：向后兼容现有 `JsonSessionRepository` 和 `SessionManager` 接口

## Commands

```bash
# 构建
npm run build

# 测试
bun run test:run

# 开发
npm run dev
```

## Project Structure

```
src/agent/
├── sessionRepository.ts    # JsonSessionRepository — 新增 index 更新逻辑
├── sessions.ts             # SessionManager — 新增 index 委托逻辑
├── constants.ts            # SESSIONS_DIR 常量定义
└── sessionService.ts       # extractTitle 等工具函数

# 索引文件位置
~/.codeagent/sessions/
├── index.json              ← 新增：会话索引缓存
├── abc-123.json            ← 现有 session 文件
└── def-456.json
```

## Code Style

### index.json Schema

```typescript
interface SessionIndex {
  version: 1;
  sessions: SessionIndexEntry[];
}

interface SessionIndexEntry {
  id: string;           // 会话 ID
  mtimeMs: number;      // 文件修改时间（用于排序）
  title: string;        // 会话标题
  messageCount: number; // 消息数量
  updatedAt: number;    // 更新时间戳
}
```

### 索引更新时机

每次 `save()` 调用后，同步更新 `index.json`：

```typescript
async save(id: string, messages: AgentMessage[], options: SaveSessionOptions = {}): Promise<void> {
  // ... 保存逻辑不变 ...
  
  // 新增：更新索引
  await this.updateIndex(id, {
    id,
    mtimeMs: Date.now(),
    title,
    messageCount: messages.length,
    updatedAt: Date.now(),
  });
}

private async updateIndex(id: string, entry: SessionIndexEntry): Promise<void> {
  const indexPath = path.join(SESSIONS_DIR, 'index.json');
  const index = await this.readIndex(); // 若不存在则创建空索引
  
  // 更新或新增条目
  const existingIdx = index.sessions.findIndex(s => s.id === id);
  if (existingIdx >= 0) {
    index.sessions[existingIdx] = entry;
  } else {
    index.sessions.push(entry);
  }
  
  // 按 mtime 降序排序
  index.sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  
  await this.atomicWriteJson(indexPath, index);
}
```

### getHistory / list 方法改造

```typescript
async list(limit: number = 50): Promise<SessionMeta[]> {
  const index = await this.readIndex();
  
  if (!index || index.sessions.length === 0) {
    // 降级：索引不存在时使用旧逻辑（启动时可能发生）
    return this.listFallback(limit);
  }
  
  // 直接从索引读取（无需文件 I/O）
  const entries = index.sessions
    .slice(0, limit)
    .map(entry => ({
      id: entry.id,
      title: entry.title,
      updatedAt: entry.updatedAt,
      messageCount: entry.messageCount,
      model: 'unknown',      // 索引中不存储这些字段
      provider: 'unknown',   // 按需从完整文件中加载
      status: 'completed' as const,
      version: SESSION_VERSION,
    }));
  
  return entries;
}
```

## Testing Strategy

- **测试框架**：Vitest
- **测试位置**：`tests/unit/sessionIndexCache.test.ts`
- **覆盖范围**：
  1. `readIndex()` — 索引不存在/损坏/正常的各种情况
  2. `updateIndex()` — 新增/更新/删除条目的正确性
  3. `list()` 使用索引 vs 降级逻辑的切换
  4. 索引排序正确性（按 mtime 降序）
  5. 索引与 session 文件 mtime 的一致性
- **边界测试**：
  - 索引损坏（JSON 解析失败）时的降级
  - 并发写入时的索引一致性（last-write-wins）
  - 会话删除后索引更新

## Boundaries

- **Always**：
  - 每次 `save()` 必须同步更新 `index.json`
  - 索引损坏时必须降级到旧逻辑（不崩溃）
  - `index.json` 必须与 session 文件保持 mtime 一致
- **Ask first**：
  - 修改 `index.json` schema（影响版本迁移）
  - 添加异步写入队列（改变一致性语义）
- **Never**：
  - 不更新 `index.json` 就保存 session（导致索引过期）
  - 不测试索引损坏的降级路径

## Success Criteria

1. **性能**：100 个会话时 `getHistory()` 响应时间 < 100ms（索引读取 + 内存排序）
2. **正确性**：`index.json` 中的 mtime 与实际 session 文件 mtime 误差 < 1 秒
3. **降级**：索引文件损坏或不存在时，`list()` 仍能返回正确结果
4. **向后兼容**：现有 API 接口不变，`list()` 返回的 `SessionMeta[]` 结构不变
5. **测试覆盖**：新增测试覆盖索引读写、排序、降级路径

## Open Questions

1. **并发写入**：多个 CLI 实例同时保存会话时，`index.json` 可能产生写入冲突。当前接受 last-write-wins，是否需要文件锁？
2. **索引裁剪**：是否会话过多时（1000+）需要对索引本身分页？当前 MVP 不考虑。
3. **字段补全**：`list()` 从索引返回时，`model`、`provider`、`status` 字段为默认值。是否需要从索引中省略这些字段，调用方按需从完整文件中加载？
