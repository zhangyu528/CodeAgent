# Context 管理

## 概述

AI Agent 使用 Context 机制管理对话上下文，通过 token 计数和压缩来优化上下文使用。

## Context 使用情况

```typescript
async getContextUsage() {
  return getContextUsage();
}

interface ContextUsage {
  tokens: number | null;      // 当前 token 数
  contextWindow: number;       // 模型上下文窗口
  percent: number | null;     // 使用百分比
}
```

## 上下文压缩 (Compact)

当上下文接近上限时，可以执行压缩：

```typescript
async compact(instructions?: string) {
  await compact(instructions);
  return { success: true };
}
```

压缩过程：
1. 分析当前上下文
2. 生成压缩指令（可选）
3. 合并历史消息为摘要
4. 更新 session

## 自动压缩

```typescript
// 设置自动压缩
async setAutoCompaction(enabled: boolean) {
  setAutoCompaction(enabled);
}

// 获取状态
async getAutoCompaction() {
  return getAutoCompaction();
}

// 检查是否正在压缩
async isCompacting() {
  return isCompacting();
}
```

## Session 统计

```typescript
getSessionStats() {
  return session?.getSessionStats() ?? null;
}
```

返回信息可能包含：
- 总消息数
- 总 token 数
- 压缩次数
- 最后压缩时间

## Token 计算

消息内容数组中的 token 计算：

```typescript
// 示例消息结构
{
  "role": "user",
  "content": [
    { "type": "text", "text": "你好" },
    { "type": "thinking", "thinking": "用户打招呼..." }
  ]
}
```

- `text` 类型计入输入 token
- `thinking` 类型不计入（内部推理）
- `toolCall` / `toolResult` 单独计算

## IPC 接口

| 方法 | 参数 | 返回值 |
|------|------|--------|
| `getContextUsage()` | - | `ContextUsage` |
| `compact(instructions?)` | `instructions?: string` | `{ success }` |
| `setAutoCompaction(enabled)` | `enabled: boolean` | `{ success }` |
| `getAutoCompaction()` | - | `boolean` |
| `isCompacting()` | - | `boolean` |
| `getSessionStats()` | - | `object \| null` |

## 阈值建议

| 百分比 | 建议操作 |
|--------|---------|
| < 50% | 正常运行 |
| 50-70% | 关注但暂不压缩 |
| 70-90% | 考虑手动 compact |
| > 90% | 必须压缩或结束对话 |

## 事件

压缩过程中会发送事件：

```typescript
onEvent(callback => {
  // event.type === 'compact' - 开始压缩
  // event.type === 'compact-done' - 压缩完成
  // event.type === 'context' - 上下文更新
})
```