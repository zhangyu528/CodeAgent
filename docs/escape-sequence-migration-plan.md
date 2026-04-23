# Escape Sequence 迁移方案

## 背景

当前 UI 层使用 Ink (React) 渲染，存在性能问题：

- 消息列表滚动时 React reconciliation 全量重算
- `VirtualMessageList` 的 `marginTop` 滚动方案在 React 渲染开销下效果有限
- 硬件 DECSTBM 滚动只能通过 alternate screen 实现，但 EscapeChatPage 是 hybrid 方案

目标：**全量使用 Escape Sequence 渲染，React 只负责状态管理和事件分发**。

---

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│  React (状态层)                                          │
│  ├── Zustand stores (chatStore, uiStore)                │
│  ├── useAgentEvents (事件订阅)                           │
│  └── 业务逻辑 (submitPrompt, switchPage 等)              │
│                        ↓ stdout.write()                 │
├─────────────────────────────────────────────────────────┤
│  Terminal (渲染层)                                        │
│  ├── ESC[?1049h  — 进入 alternate screen               │
│  ├── ESC[3;{bottom}r — DECSTBM scroll region           │
│  ├── ESC[line;colH — cursor 定位                        │
│  └── 所有 UI 直接写 stdout (无 React 渲染)              │
└─────────────────────────────────────────────────────────┘
```

**核心原则**：React 只管状态和事件，**零 Ink 渲染**。

---

## 模块划分

```
src/apps/cli/escape/
├── core/
│   ├── Terminal.ts        # 终端封装：光标、颜色、清屏、alternate screen
│   ├── ScrollRegion.ts    # DECSTBM 滚动区域管理
│   ├── InputCapture.ts    # raw mode 按键捕获
│   └── Layout.ts          # 固定布局：header / messages / input 各占行数
├── pages/
│   ├── WelcomePage.ts     # 欢迎页（Logo + Input 提示）
│   ├── InitPage.ts        # 初始化页
│   └── ChatPage.ts        # 聊天页
├── components/
│   ├── EscapeMessageList.ts   # 消息列表（流式写入，DECSTBM 滚动）
│   ├── EscapeInput.ts         # 输入区（raw mode 捕获 + 渲染）
│   ├── EscapeHeader.ts        # 头部
│   ├── EscapeSlashList.ts     # / 命令面板
│   └── EscapeContextBar.ts    # 底部上下文栏
├── modals/
│   ├── EscapeModal.ts         # 模态框基类
│   ├── EscapeConfirm.ts
│   ├── EscapeAsk.ts
│   └── EscapeSelectOne.ts
└── index.ts               # 导出，用法：<EscapeApp />
```

---

## 逐模块迁移对照表

| 当前模块 (Ink)                             | 迁移到                     | 复杂度 | 说明                                       |
| ------------------------------------------ | -------------------------- | ------ | ------------------------------------------ |
| `VirtualMessageList`                       | `EscapeMessageList`        | ★★★    | 用 DECSTBM scroll region，流式追加行       |
| `MessageItem`                              | 内联到 `EscapeMessageList` | ★★     | 直接拼接 ANSI 字符串                       |
| `DateDivider`                              | 内联                       | ★      | 格式化日期分隔行                           |
| `TypingIndicator`                          | 内联                       | ★      | 流式写入动画字符                           |
| `Input` + `InputController` + `InputField` | `EscapeInput`              | ★★★    | raw mode 捕获按键，`\r` 提交，`/` 前缀检测 |
| `SlashList`                                | `EscapeSlashList`          | ★★     | 独立 scroll list，`↑↓` 导航                |
| `ContextBar`                               | `EscapeContextBar`         | ★      | 直接拼接字符串写到底部行                   |
| `ChatHeader`                               | `EscapeHeader`             | ★      | 固定 2 行，直接写死                        |
| `WelcomePage`                              | `WelcomePage` (escape 版)  | ★★     | Logo 静态 ASCII + Input 提示               |
| `InitPage`                                 | `InitPage` (escape 版)     | ★      | loading spinner                            |
| `ModalContainer` + 所有 Modal              | `EscapeModal` 系列         | ★★★    | alternate screen 嵌套或固定区域覆盖        |
| `App.tsx`                                  | `EscapeApp.tsx`            | ★★     | 删 Ink，保留 initPromise + page 状态       |
| `AppController`                            | 拆入 `EscapeApp`           | ★      | 复用 `page` 状态、`terminalSize` 监听      |

---

## 关键实现细节

### Terminal 底层 (core/Terminal.ts)

```typescript
const CSI = '\x1b[';
const ESC = '\x1b';

export const T = {
  // 光标
  cursorTo: (row: number, col = 1) => `${CSI}${row};${col}H`,
  clearLine: () => `${CSI}2K`,
  clearScreen: () => `${CSI}2J`,

  // Alternate screen
  enterAlt: () => `${CSI}?1049h`,
  exitAlt: () => `${CSI}?1049l`,

  // DECSTBM scroll region
  setScroll: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  scrollUp: (n = 1) => `${CSI}${n}S`,
  scrollDown: (n = 1) => `${CSI}${n}T`,

  // 颜色
  bold: () => `${CSI}1m`,
  dim: () => `${CSI}2m`,
  reset: () => `${CSI}0m`,
  fg: (c: number) => `${CSI}${c}m`,
  bg: (c: number) => `${CSI}${c}m`,
};
```

### 布局常量 (core/Layout.ts)

```typescript
// 固定行数分配（可随 terminal height 动态调整）
export function getLayout(rows: number) {
  return {
    headerRows: 2,
    headerTop: 1,
    headerBottom: 2,

    inputRows: 8,
    inputTop: rows - 8,
    inputBottom: rows,

    // 消息区在 header 和 input 之间
    scrollTop: 3,
    scrollBottom: rows - 9,

    // 可变消息区高度
    messageAreaHeight: rows - 11,
  };
}
```

### 流式消息列表 (components/EscapeMessageList.ts)

- 追加渲染：新消息直接 append 到 scroll region，不重绘全量
- 全量重绘：resize / 切换会话时清屏重绘
- 流式写入：逐字符/逐词写入当前光标位置

### 输入捕获 (core/InputCapture.ts)

- 使用 Ink `useInput` 捕获按键（兼容现有架构，组件返回 null）
- 输入内容变化时直接写终端渲染，不通过 React state 驱动 UI
- `EscapeInput` 组件只负责注册 useInput 回调，实际渲染由回调里的 `process.stdout.write()` 完成

---

## 迁移顺序

### Phase 1: 基础设施

1. `core/Terminal.ts` — 终端封装
2. `core/Layout.ts` — 布局常量
3. `core/InputCapture.ts` — 按键捕获封装

### Phase 2: 核心页面

4. `components/EscapeHeader.ts`
5. `components/EscapeMessageList.ts`
6. `components/EscapeInput.ts`
7. `pages/EscapeChatPage.ts`

### Phase 3: 辅助组件

8. `components/EscapeSlashList.ts`
9. `components/EscapeContextBar.ts`

### Phase 4: 配套页面

10. `pages/WelcomePage.ts`
11. `pages/InitPage.ts`

### Phase 5: 模态框

12. `modals/EscapeModal.ts`
13. `modals/EscapeConfirm.ts`
14. `modals/EscapeAsk.ts`
15. `modals/EscapeSelectOne.ts`

### Phase 6: 整合

16. `EscapeApp.tsx`
17. `index.ts`
18. 修改 `App.tsx` 始终使用 escape 版

### Phase 7: 清理

19. 删除 `/ink` 目录下不再需要的文件

---

## 与现有系统的接口

```typescript
// EscapeApp 保持和 App.tsx 相同的 props 接口
interface EscapeAppProps {
  initPromise: Promise<AgentSession>;
}

// 状态层完全复用
import { useChatStore } from './store/chatStore.js';
import { useAppStore } from './store/uiStore.js';
// 状态层不变，EscapeApp 只是不再用 React 渲染它们

// 事件订阅复用
import { useAgentEvents } from './hooks/useAgentEvents.ts';
// 这个 hook 返回的回调仍然有用，EscapeApp 在 state 变化时写终端
```

---

## 注意事项

1. **Ink `useInput` 可保留**：不需要完全去掉 Ink。`useInput` 只是监听按键，React reconciliation 在组件返回 `null` 时几乎无开销。可以继续用 `useInput` 捕获按键，UI 渲染全部走 escape sequence。

2. **流式输出是关键**：消息流式写入时，不要等消息完整再渲染。按 `text_delta` 事件逐段追加到终端。

3. **模态框叠加**：模态框激活时的绘制策略——清屏重绘或固定区域覆盖。

4. **Cursor 位置管理**：每个模块写入后，光标必须放在用户期望的位置（一般是 input 区的光标位置）。

5. **Resize 处理**：terminal resize 时需要重新计算布局并全量重绘。

6. **Cleanup**：组件 unmount 时必须恢复 alternate screen 状态（`ESC[?1049l`），否则终端状态被污染。
