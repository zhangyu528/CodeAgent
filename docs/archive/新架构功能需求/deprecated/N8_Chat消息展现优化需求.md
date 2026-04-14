# Chat 消息展现优化需求

## 1. 概述

### 1.1 背景

当前 Ink Chat 页面展示消息的结构为：

```typescript
ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  title: string;
  createdAt: number;
  status?: 'streaming' | 'completed' | 'error';
  blocks: ChatMessageBlock[];
}

ChatMessageBlock =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string; collapsed?: boolean }
  | { kind: 'toolSummary'; text: string; collapsed?: boolean };
```

### 1.2 当前展现形式

| 元素 | 现状 |
|------|------|
| Header | role label + 时间 + status(streaming/error) |
| Text | 绿色(assistant)/青色(user)/红色(error) |
| Thinking | 灰色，默认折叠显示 `[Reasoning hidden • N chars]` |
| Tool Summary | 灰色，折叠显示 `[Tools • N chars]` |
| Border | 用 `borderStyle="round"` + role 颜色 |

---

## 2. 用户需求分析

### 2.1 核心需求

1. **快速定位信息** — 区分哪些是思考、哪些是工具结果、哪些是最终答案
2. **节省屏幕空间** — 长输出折叠，只看关键结果
3. **了解进度** — streaming 时知道正在输出
4. **追溯来源** — 看到工具调用了什么、返回了什么

### 2.2 LLM 返回内容类型

```
1. Text (最终回复)          ← 用户最想看
2. Thinking (推理过程)     ← 用户可能想看/不想看
3. Tool Summary (工具摘要)  ← 用户需要知道"做了什么"
```

---

## 3. 需求详情

### 3.1 P0 - Tool Summary 格式化输出

**问题：** 当前只显示 `[Tools • N chars]`，用户无法直观了解调用了哪些工具。

**期望展现：**

```
[Tools]
  ├── browser_navigate: "https://..."
  ├── terminal: "npm run build"
  └── file_search: "*.tsx"
```

**实现方式：**
- 解析 tool_summary 的 text，识别工具名称和参数
- 格式化为树形/列表结构输出
- 工具名称用高亮色，参数用引号包裹

---

### 3.2 P1 - Thinking 折叠体验优化

**问题：** `collapsed !== false` 逻辑绕，且折叠时显示 char 数量不够直观。

**期望：**
- 默认折叠（用户主动展开）
- 折叠时显示简短标签：`[Reasoning]`
- 展开时缩进 + 灰色显示

**实现方式：**
- 简化折叠逻辑：`collapsed: true` 时折叠
- 折叠时只显示 `▸ [Reasoning]`
- 展开后显示 `▾ [Reasoning]` + 内容（缩进）

---

### 3.3 P1 - 时间分组显示

**问题：** 长会话中，所有消息时间连续显示，不易区分日期边界。

**期望：**

```
今天
├── 14:32 You: xxx
└── 14:33 Assistant: xxx

昨天
├── 10:00 You: xxx
└── 10:01 Assistant: xxx
```

**实现方式：**
- 按日期分组消息
- 显示日期分隔线
- 同一天内消息紧凑排列

---

### 3.4 P2 - Streaming 状态增强

**问题：** 目前只显示 `• streaming`，信息量少。

**期望：**
- 显示当前输出的字符数
- 或显示一个加载动画（如 `...` 闪烁）

**实现方式：**
- 在 streaming 时显示 `• streaming (N chars)`
- 或在消息末尾显示 `░` 填充块动画

---

### 3.5 P2 - Text 块分隔

**问题：** 如果消息有多个 text 块，直接拼接显示没有区隔。

**期望：**
- 多个 text 块之间加分隔符（如空行或 `───`）
- 或每个块独立渲染，保留结构

---

### 3.6 P2 - 展开/折叠交互优化

**可选增强：**
- 点击即可展开/折叠 thinking/tool_summary
- 键盘快捷键切换（如 `e` 展开所有 / `c` 折叠所有）

---

## 4. 优先级汇总

| 优先级 | 改进项 | 理由 |
|--------|--------|------|
| P0 | Tool Summary 格式化为结构化输出 | 当前太抽象，用户无法快速了解工具调用 |
| P1 | Thinking 折叠体验优化 | 提升折叠逻辑清晰度 |
| P1 | 时间分组显示 | 长会话更清晰易读 |
| P2 | Streaming 状态增强 | 可选优化 |
| P2 | Text 块分隔 | 可选优化 |
| P2 | 展开/折叠交互优化 | 后续可做 |

---

## 5. 数据结构影响

### 5.1 可能需要新增的数据字段

```typescript
// tool_summary 增强：解析出结构化数据
type ToolSummaryBlock = {
  kind: 'toolSummary';
  text: string;
  collapsed?: boolean;
  tools: Array<{
    name: string;
    args?: string;
    result?: string; // 可选原始结果
  }>;
};

// thinking 简化
type ThinkingBlock = {
  kind: 'thinking';
  text: string;
  collapsed: boolean; // 默认 true
};
```

### 5.2 不影响的内容

- `ChatMessage` 基本结构不变
- `ChatPageProps` 接口不变
- scroll 功能不受影响

---

## 6. 参考

- 当前实现：`src/apps/cli/ink/components/pages/chat_page.tsx`
- 类型定义：`src/apps/cli/ink/components/pages/types.ts`
