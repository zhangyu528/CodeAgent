# Chat 页面重构需求

## 1. 概述

### 1.1 背景

当前 Ink 程序中 `pi_app.tsx` (783行) 和 `chat_page.tsx` (518行) 过于庞大，导致：
- 代码难以维护和理解
- 难以进行单元测试
- 新功能开发效率低
- Bug 定位困难

### 1.2 当前代码结构

| 文件 | 行数 | 主要职责 |
|------|------|----------|
| `pi_app.tsx` | 783 | 主应用组件，包含所有业务逻辑 |
| `chat_page.tsx` | 518 | 聊天页面，消息渲染逻辑复杂 |
| `pi_app_reducer.ts` | 413 | 状态管理 reducer |
| `useModelConfig.ts` | 239 | 模型配置 hook（已提取） |
| `input_area.tsx` | 111 | 输入区域组件 |

**总计：** 2707 行代码

---

## 2. 重构方案总览

| 阶段 | 方案 | 目标 | 风险 |
|------|------|------|------|
| 阶段一 | 拆分 ChatPage 组件 | UI 组件化 | 低 |
| 阶段二 | 拆分 pi_app.tsx | 逻辑职责分离 | 中 |
| 阶段三 | 拆分 Reducer | 状态管理清晰化 | 中 |
| 阶段四 | 提取自定义 Hooks | 代码复用与可测试性 | 低 |

---

## 3. 阶段一：拆分 ChatPage 组件

### 3.1 目标

将 518 行的 `chat_page.tsx` 拆分为多个可复用的 UI 组件。

### 3.2 拆分方案

```
components/pages/chat/
├── ChatPage.tsx              # 主组件，组合子组件
├── MessageList.tsx           # 消息列表容器
├── MessageItem.tsx           # 单条消息渲染
├── DateDivider.tsx          # 日期分隔线
├── ChatHeader.tsx           # 聊天头部信息
├── TypingIndicator.tsx      # AI 思考中指示器
└── MessageCard.tsx           # 消息卡片（已有）
```

### 3.3 组件职责

| 组件 | 职责 | 预计行数 |
|------|------|----------|
| `ChatPage` | 组合子组件，处理滚动逻辑 | ~100 |
| `MessageList` | 管理消息列表渲染，分组 | ~150 |
| `MessageItem` | 根据角色渲染不同消息样式 | ~100 |
| `DateDivider` | 显示日期分隔 | ~30 |
| `ChatHeader` | 显示会话信息、模型名称 | ~50 |
| `TypingIndicator` | AI 思考动画 | ~30 |

### 3.4 实施步骤

- [ ] 创建 `components/pages/chat/` 目录
- [ ] 提取 `DateDivider` 组件
- [ ] 提取 `ChatHeader` 组件
- [ ] 提取 `TypingIndicator` 组件
- [ ] 提取 `MessageItem` 组件（根据 role 渲染）
- [ ] 提取 `MessageList` 组件（消息分组、日期分隔）
- [ ] 重构 `ChatPage` 为主组合组件
- [ ] 更新 `components/pages/index.ts` 导出

### 3.5 验收标准

1. 所有功能与重构前一致
2. 每个组件独立可测试
3. Props 类型定义清晰
4. 无循环依赖

---

## 4. 阶段二：拆分 pi_app.tsx

### 4.1 目标

将 783 行的 `pi_app.tsx` 按职责拆分为多个模块。

### 4.2 拆分方案

```
pi_app/
├── pi_app.tsx                  # 主组件，只做组合和渲染
├── hooks/
│   ├── useAgent.ts             # Agent 订阅逻辑
│   ├── useSession.ts           # 会话管理逻辑
│   ├── useInputHandlers.ts     # 各种输入处理
│   └── useFocusManager.ts      # 焦点管理
└── handlers/
    ├── handleExit.ts           # 退出处理
    ├── handleModal.ts          # 模态框处理
    ├── handleSlash.ts          # 斜杠命令处理
    └── handleRegular.ts        # 常规输入处理
```

### 4.3 组件/模块职责

| 模块 | 职责 | 预计行数 |
|------|------|----------|
| `pi_app.tsx` | 初始化状态、组合组件、渲染 | ~200 |
| `useAgent.ts` | agent.subscribe()、事件处理 | ~80 |
| `useSession.ts` | 会话创建、恢复、保存 | ~100 |
| `useInputHandlers.ts` | 键盘事件分发 | ~120 |
| `useFocusManager.ts` | 焦点状态管理 | ~60 |
| `handlers/handleExit.ts` | 退出逻辑 | ~30 |
| `handlers/handleModal.ts` | 模态框输入处理 | ~60 |
| `handlers/handleSlash.ts` | 斜杠命令处理 | ~40 |
| `handlers/handleRegular.ts` | 常规输入处理 | ~40 |

### 4.4 实施步骤

**第一步：创建目录结构**
- [ ] 创建 `pi_app/hooks/` 目录
- [ ] 创建 `pi_app/handlers/` 目录

**第二步：提取 Hooks**
- [ ] 提取 `useAgent.ts` - Agent 订阅逻辑
- [ ] 提取 `useSession.ts` - 会话管理
- [ ] 提取 `useFocusManager.ts` - 焦点管理
- [ ] 提取 `useInputHandlers.ts` - 输入处理分发

**第三步：提取 Handlers**
- [ ] 提取 `handleExit.ts`
- [ ] 提取 `handleModal.ts`
- [ ] 提取 `handleSlash.ts`
- [ ] 提取 `handleRegular.ts`

**第四步：重构 pi_app.tsx**
- [ ] 简化主组件，只保留组合逻辑
- [ ] 更新 import 路径
- [ ] 测试所有功能正常

### 4.5 验收标准

1. 所有功能与重构前一致
2. 每个模块独立可测试
3. 无循环依赖
4. 模块间接口清晰

---

## 5. 阶段三：拆分 Reducer

### 5.1 目标

将 413 行的 `pi_app_reducer.ts` 拆分为多个小 reducer，提高可测试性。

### 5.2 拆分方案

```typescript
// 之前：一个巨大的 reducer
function piAppReducer(state, action) { ... }

// 之后：多个小 reducer
const inputReducer = createReducer(initialInputState, {
  INPUT_KEY: (state, action) => { ... }
});

const modalReducer = createReducer(initialModalState, {
  COMMAND_EXEC: (state, action) => { ... }
});

const combinedReducer = combineReducers({
  input: inputReducer,
  modal: modalReducer,
  session: sessionReducer,
  thinking: thinkingReducer,
  ...
});
```

### 5.3 Reducer 拆分

| Reducer | 状态 | 负责 Action |
|---------|------|-------------|
| `inputReducer` | inputValue, slashSelected | INPUT_KEY |
| `modalReducer` | modal, page | COMMAND_EXEC, MODEL_CONFIG_EVENT |
| `sessionReducer` | currentSession, activeSessionId | SESSION_* |
| `thinkingReducer` | thinking, usage | THINKING_* |
| `exitReducer` | exitPromptVisible | EXIT_CONFIRM_EVENT |
| `appReducer` | rows, columns, debug | APP_* |

### 5.4 实施步骤

- [ ] 分析现有 reducer 代码结构
- [ ] 定义各子 reducer 的状态接口
- [ ] 实现各子 reducer
- [ ] 实现根 reducer（combineReducers）
- [ ] 更新 pi_app.tsx 中的 dispatch 使用方式
- [ ] 测试所有 action 处理正常

### 5.5 验收标准

1. 所有 action 处理与重构前一致
2. 每个 reducer 可独立测试
3. 状态类型定义完整

---

## 6. 阶段四：提取自定义 Hooks

### 6.1 目标

将重复逻辑和复杂逻辑提取为自定义 Hooks，提高代码复用性。

### 6.2 待提取的 Hooks

| Hook | 用途 | 来源 |
|------|------|------|
| `useAutoScroll` | 消息列表自动滚动 | chat_page.tsx |
| `useDateGrouping` | 消息按日期分组 | chat_page.tsx |
| `useTerminalSize` | 终端尺寸监听 | pi_app.tsx |
| `useKeyboardShortcuts` | 全局快捷键 | pi_app.tsx |
| `useDebounce` | 防抖 | 多个文件 |

### 6.3 实施步骤

- [ ] 创建 `hooks/` 目录（如果没有）
- [ ] 提取 `useAutoScroll.ts`
- [ ] 提取 `useDateGrouping.ts`
- [ ] 提取 `useTerminalSize.ts`
- [ ] 提取 `useKeyboardShortcuts.ts`
- [ ] 更新各组件使用新 Hooks
- [ ] 删除重复的实现

### 6.4 验收标准

1. Hooks 可复用
2. 功能与原有实现一致
3. 无重复代码

---

## 7. 实施计划总结

### 阶段依赖关系

```
阶段一（ChatPage 拆分）
    ↓
阶段二（pi_app.tsx 拆分）
    ↓
阶段三（Reducer 拆分）
    ↓
阶段四（提取 Hooks）
```

### 时间估算（相对）

| 阶段 | 复杂度 | 预计时间 |
|------|--------|----------|
| 阶段一 | 低 | 1-2 天 |
| 阶段二 | 中 | 2-3 天 |
| 阶段三 | 中 | 1-2 天 |
| 阶段四 | 低 | 0.5-1 天 |

### 总体目标

- 代码行数减少 50%+
- 每个模块独立可测试
- 新功能开发效率提升
- Bug 定位更容易

---

## 8. 风险与注意事项

### 风险

| 风险 | 应对措施 |
|------|----------|
| 重构过程中引入 Bug | 每个阶段完成后进行全面测试 |
| Props drilling 加重 | 适当使用 Context |
| 循环依赖 | 遵循单向数据流原则 |
| 性能下降 | 使用 React.memo 优化 |

### 注意事项

1. **不要在重构时添加新功能**
2. **每次小改动后都要测试**
3. **保持 commit 粒度小**
4. **更新相应的类型定义**
5. **注意 Ink 组件的特殊性（不能使用某些 React 模式）**

---

## 9. 待办

- [ ] 阶段一：拆分 ChatPage 组件
- [ ] 阶段二：拆分 pi_app.tsx
- [ ] 阶段三：拆分 Reducer
- [ ] 阶段四：提取自定义 Hooks
