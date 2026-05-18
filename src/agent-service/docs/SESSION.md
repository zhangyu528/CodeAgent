# Session 管理

## 概述

Session 是 AI Agent 的对话单元，每个 Session 包含：
- 唯一 ID
- 消息历史
- 关联的 Project（可选）
- 创建/修改时间
- 首条消息摘要

## Session 文件格式

Session 存储为 JSONL 文件：

```
sessions/
├── __global__/                    # 全局 Session
│   └── 1778830744809_xxx.jsonl
├── --D--work-project-Test--/       # 项目 Session
│   └── 1778830744809_xxx.jsonl
```

### 文件结构

```jsonl
{"id":"xxx","type":"session","version":2,"timestamp":1778830744809,"name":"项目名","cwd":"D:\\work\\project\\Test"}
{"role":"user","content":[{"type":"text","text":"你好"}],"timestamp":1777809646048}
{"role":"assistant","content":[{"type":"thinking","thinking":"用户用中文打招呼..."},{"type":"text","text":"你好！有什么我可以帮你的吗？"}],"timestamp":1777809646108}
```

## Session 类型定义

```typescript
interface SessionInfo {
  id: string;
  path: string;
  cwd: string;
  name: string | undefined;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
}

interface SessionGroup {
  global: Session[];
  byProject: Record<string, Session[]>;
}
```

## Session 显示名称

格式：`{相对时间} · {首消息摘要}`

| 场景 | 示例 |
|------|------|
| 今天的对话 | `今天 14:30 · 你好，我想了解...` |
| 昨天的对话 | `昨天 · 请帮我检查代码` |
| 更早 | `05-10 · 项目结构是...` |

生成规则：
1. 读取 session 文件的首条用户消息
2. 截取前 12 字符 + "..."
3. 时间转相对格式：今天/昨天/日期

## Session 生命周期

```
创建 Session
    ↓
首条 prompt 发送
    ↓
消息追加到 JSONL 文件
    ↓
用户切换 Session
    ↓
加载对应 JSONL 文件
    ↓
继续对话或创建新消息
```

## 关键函数

| 函数 | 文件 | 功能 |
|------|------|------|
| `createSessionFile()` | `pool.ts` | 创建新的 Session 文件 |
| `activateSession()` | `pool.ts` | 激活指定 Session |
| `listAllSessions()` | `pool.ts` | 列出所有 Session |
| `renameSession()` | `pool.ts` | 重命名 Session |
| `deleteSession()` | `pool.ts` | 删除 Session 文件 |

## Session 与 Project 的关系

- 每个 Project 可以有多个 Session
- 全局 Session（无 Project）存放在 `sessions/__global__/`
- Project Session 存放在 `sessions/--{projectPath}--/`

## IPC 接口

| 方法 | 说明 |
|------|------|
| `listSessions()` | 列出所有 Session |
| `listSessionGroups()` | 按项目分组列出 |
| `createSession(name?)` | 创建项目 Session |
| `createGlobalSession(name?)` | 创建全局 Session |
| `createSessionForProject(cwd, name?)` | 为项目创建 Session |
| `switchSession(path, cwd)` | 切换到 Session |
| `deleteSession(path)` | 删除 Session |
| `renameSession(path, name)` | 重命名 Session |