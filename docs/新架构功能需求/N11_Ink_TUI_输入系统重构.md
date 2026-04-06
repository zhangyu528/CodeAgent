# 功能需求 N11：Ink TUI 输入系统重构

## 状态

- **完成时间**：2026-04-06
- **状态**：✅ 已完成
- **基于版本**：commit 7723aa4（四阶段重构后）→ 当前 working directory

---

## 1. 变更总览

| 维度 | 原架构 (7723aa4) | 新架构 | 改进效果 |
|------|------------------|--------|----------|
| **根组件** | `pi_app.tsx` (~500行巨型组件) | `App.tsx` + `AppController.ts` | 职责分离 |
| **状态管理** | useReducer 单一 reducer | Zustand 多 store | 更新精准、无需 dispatch |
| **输入处理** | 内嵌在 pi_app.tsx | `InputController.ts` 独立 | 可测试、可复用 |
| **Debug 系统** | `useDebug` hook (useState) | `debugStore` (Zustand) | 任意位置调用、无 prop 传递 |
| **TTY 处理** | 无检查 | `index.tsx` 顶层退出 | 早期失败、明确错误 |
| **Enter 键** | 仅 `key.return` | `key.return \|\| input === '\r'` | Windows Terminal 兼容 |

---

## 2. 架构详细对比

### 2.1 根组件复杂度

#### 原架构：`pi_app.tsx` (~500行)

```typescript
// 原架构问题：
// 1. 所有状态集中在一个 useReducer
// 2. 所有事件处理内联
// 3. UI 组件直接渲染
export function PiInkApp({ agent, onExit }: PiInkAppProps) {
  const { exit } = useApp();
  const { isRawModeSupported, setRawMode } = useStdin();
  const [state, dispatch] = useReducer(
    piAppReducer,
    createInitialState(stdout.columns || 80, stdout.rows || 24)
  );
  const [historyItems, setHistoryItems] = useState<SessionInfo[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSessionInfo | null>(null);
  // ... 大量 useState
  
  // useEffect 瀑布
  useEffect(() => { /* 初始化 */ });
  useEffect(() => { /* 监听 agent */ });
  useEffect(() => { /* 保存 session */ });
  useEffect(() => { /* resize */ });
  
  // 巨型 render 逻辑
  return (
    <Box>
      {state.page === 'welcome' && <WelcomePage ... />}
      {state.page === 'chat' && (
        <>
          <ChatHeader ... />
          <MessageList ... />
          <InputArea 
            page={state.page}
            inputValue={state.inputValue}
            onInput={handleInput}
            isDimmed={state.thinking}
            // ... 大量 prop
          />
        </>
      )}
    </Box>
  );
}
```

**问题分析：**

| 问题 | 影响 |
|------|------|
| ~500 行单一函数 | 无法定位逻辑、维护困难 |
| ~20 个 useEffect | 初始化顺序依赖、容易出错 |
| ~15 个 useState | 状态分散、难以追踪 |
| 巨型 reducer | action 类型膨胀、reducer 超千行 |

#### 新架构：`App.tsx` + `AppController.ts`

```typescript
// App.tsx - 纯粹组合
export function App() {
  return (
    <ErrorBoundary>
      <AppController />
    </ErrorBoundary>
  );
}

// AppController.ts - 协调者，薄薄一层
export function AppController() {
  const { page, isDebugVisible } = useUIStore();
  
  return (
    <Box flexDirection="column" height="100%">
      {page === 'welcome' && <WelcomePage />}
      {page === 'chat' && <ChatPage />}
      <InputArea />
      <ModalContainer />
      {isDebugVisible && <DebugPanel />}
    </Box>
  );
}
```

**改进效果：**

| 改进 | 效果 |
|------|------|
| App.tsx ~50 行 | 只负责组合 |
| 无 useState | 状态在 store |
| 无 useEffect | 副作用在 hooks |

---

### 2.2 状态管理对比

#### 原架构：useReducer 单一 reducer

```typescript
// state/pi_app_reducer.ts
export type PiAppAction =
  | InputKeyAction      // 8 种操作
  | CommandExecAction   // 12 种操作
  | SessionRestoredAction
  | AgentEventAction    // 8 种操作
  | ModelConfigEventAction
  | ExitConfirmEventAction
  | UiAction;

// reducer 函数 ~200 行
function piAppReducer(state: PiAppState, action: PiAppAction): PiAppState {
  switch (action.type) {
    case 'INPUT_KEY':
      switch (action.op) {
        case 'set_value': return { ...state, inputValue: action.value };
        case 'append_value': return { ...state, inputValue: state.inputValue + action.value };
        case 'backspace': return { ...state, inputValue: state.inputValue.slice(0, -1) };
        // ...
      }
    // ... 大量分支
  }
}
```

**问题分析：**

| 问题 | 影响 |
|------|------|
| 单一 reducer | 任何状态变化都触发重渲染整个组件 |
| Action 类型多 | ~30 种 action，难以记忆 |
| 状态分散 | inputValue、messages、modal 在不同 action 中修改 |
| 难以测试 | 需要构造完整 action 对象 |

#### 新架构：Zustand 多 store

```typescript
// store/uiStore.ts - UI 状态
export const useUIStore = create<UIState & UIActions>((set) => ({
  page: 'welcome',
  inputValue: '',
  messages: [],
  // ...
  setInputValue: (value) => set({ inputValue: value }),
  appendInputValue: (value) => set(state => ({ inputValue: state.inputValue + value })),
}));

// store/debugStore.ts - Debug 状态
export const useDebugStore = create<DebugState & DebugActions>((set) => ({
  messages: [],
  addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] })),
}));
```

**改进效果：**

| 改进 | 效果 |
|------|------|
| 按职责拆分 store | uiStore、debugStore、modalStore |
| 精确 selector | `useUIStore(s => s.inputValue)` 只订阅需要的字段 |
| 异步支持 | Zustand 原生支持异步 action |
| 调试友好 | DevTools 可查看状态变化 |

**useReducer vs Zustand 对比：**

| 维度 | useReducer | Zustand |
|------|------------|---------|
| 样板代码 | 多（action type + dispatch） | 少（直接 set） |
| 跨组件共享 | 需要 Context 或提升到父组件 | 直接共享 |
| DevTools | 需要额外配置 | 内置支持 |
| 性能优化 | 需要 useMemo + React.memo | selector 自动优化 |
| 学习曲线 | 低（React 内置） | 中（第三方） |

---

### 2.3 输入处理对比

#### 原架构：内嵌在 pi_app.tsx

```typescript
// 原架构在 pi_app.tsx 内联处理
useEffect(() => {
  if (focusOwner !== 'mainInput') return;
  
  const handleKey = (input, key) => {
    if (key.return) {
      handleSubmit(state.inputValue);
    } else if (key.backspace) {
      dispatch({ type: 'INPUT_KEY', op: 'backspace' });
    } else if (input) {
      dispatch({ type: 'INPUT_KEY', op: 'append_value', value: input });
    }
  };
  
  useInput(handleKey, { isActive: focusOwner === 'mainInput' });
}, [focusOwner, state.inputValue]);
```

**问题分析：**

| 问题 | 影响 |
|------|------|
| 内联在组件内 | 无法单独测试输入逻辑 |
| 依赖外部状态 | 必须访问 state.inputValue、dispatch |
| 逻辑分散 | slash、history、mainInput 混在一起 |
| 重复代码 | 每个焦点区域都需要类似处理 |

#### 新架构：InputController.ts 独立

```typescript
// components/inputs/InputController.ts
export function useInput() {
  const { value, setValue, submitPrompt } = useInputState();
  const { hasSlash, selectedIndex, commands } = useSlashList(value, ...);
  
  useKeyboardInput((input, key) => {
    // Return - submit or execute slash command
    if (key.return || input === '\r') {
      const hasSlash = value.startsWith('/') && !value.includes(' ');
      if (hasSlash) {
        return; // delegating to SlashListController
      } else {
        submitPrompt(value);
      }
      return;
    }
    
    // Character input
    if (input) {
      setValue(prev => prev + input);
      return;
    }
    
    // Backspace
    if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
      return;
    }
  });
  
  return { value, setValue, ... };
}
```

**改进效果：**

| 改进 | 效果 |
|------|------|
| 独立文件 | 可单独测试 |
| 职责单一 | 只处理输入逻辑 |
| 可复用 | 其他组件可使用 |
| Windows 兼容 | 同时处理 `\r` 和 `\n` |

---

### 2.4 Debug 系统对比

#### 原架构：useDebug hook (useState)

```typescript
// hooks/useDebug.ts
export function useDebug(defaultVisible = false) {
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(defaultVisible);
  
  const addDebugMessage = useCallback((message: string) => {
    setDebugMessages(prev => 
      [...prev.slice(-99), `[${new Date().toISOString().slice(11, 19)}] ${message}`]
    );
  }, []);
  
  return { debugMessages, isDebugVisible, setIsDebugVisible, addDebugMessage };
}

// 使用：必须在 PiInkApp 组件内
export function PiInkApp() {
  const { debugMessages, isDebugVisible, addDebugMessage, toggleDebug } = useDebug();
  
  // 需要通过 prop 传递
  return <InputArea onDebugMessage={addDebugMessage} />;
}
```

**问题分析：**

| 问题 | 影响 |
|------|------|
| 必须作为组件 prop 传递 | 深层组件需要层层传递 |
| 消息数量有限制 | `slice(-99)` 只保留 100 条 |
| 无法在非组件位置调用 | hooks 必须在组件内 |
| 状态与 UI 耦合 | Debug 状态和 DebugPanel 在同一组件管理 |

#### 新架构：Zustand debugStore

```typescript
// components/debug/debugStore.ts
export const useDebugStore = create<DebugState & DebugActions>((set) => ({
  messages: [],
  addMessage: (msg) => set(state => ({
    messages: [...state.messages.slice(-199), msg]  // 保留 200 条
  })),
}));

// 使用：任意位置
// 1. 组件内
function MyComponent() {
  const addMessage = useDebugStore(s => s.addMessage);
  // ...
}

// 2. 非组件位置（如工具函数）
import { useDebugStore } from '../debug/debugStore';
export function myTool() {
  useDebugStore.getState().addMessage('[Tool] doing something');
}

// 3. 在 DebugPanel 中订阅
function DebugPanel() {
  const messages = useDebugStore(s => s.messages);
  // ...
}
```

**改进效果：**

| 改进 | 效果 |
|------|------|
| 无需 prop 传递 | `useDebugStore.getState().addMessage()` 任意位置 |
| 可配置保留数量 | `slice(-199)` 可调整 |
| 状态与 UI 分离 | debugStore 独立、DebugPanel 只负责渲染 |
| 可在非组件位置调用 | 工具函数、事件处理函数都能用 |

---

### 2.5 TTY 处理对比

#### 原架构：无 TTY 检查

```typescript
// 原架构 pi_app.tsx
export function PiInkApp({ agent, onExit }: PiInkAppProps) {
  // 无 TTY 检查
  // 直接渲染，可能在非 TTY 环境下崩溃
  return <Box>...</Box>;
}
```

**问题分析：**

| 问题 | 影响 |
|------|------|
| 无 TTY 检查 | 非 TTY 环境可能静默失败 |
| 错误时机晚 | 可能在渲染一半后才出错 |
| 错误信息不友好 | 用户不知道原因 |

#### 新架构：index.tsx 顶层检查

```typescript
// index.tsx
export async function bootstrap() {
  if (!process.stdin.isTTY) {
    console.log('Error: Interactive mode requires a TTY terminal.');
    console.log('Please run this command in a local terminal session.');
    process.exit(1);  // 早期退出，明确错误
  }
  
  process.stdout.write('\u001b[?1049h'); // alternate screen
  process.stdout.write('\u001b[?25l');    // hide cursor
  
  const { waitUntilExit } = render(<App />, { exitOnCtrlC: false });
  await waitUntilExit();
}
```

**改进效果：**

| 改进 | 效果 |
|------|------|
| 早期失败 | 在任何渲染前检查 |
| 明确错误信息 | 告诉用户如何解决 |
| 资源清理 | 终端设置在 App 内统一管理 |

---

### 2.6 Enter 键兼容性对比

#### 原架构：仅处理 `\n`

```typescript
// 原架构
if (key.return) {
  handleSubmit(inputValue);
}
```

**问题分析：**

| 问题 | 影响 |
|------|------|
| Windows Terminal 发送 `\r\n` | 可能导致 Enter 无反应 |
| 未测试 Windows 环境 | Linux/macOS 可能正常，Windows 异常 |

#### 新架构：同时处理 `\r` 和 `\n`

```typescript
// 新架构
if (key.return || input === '\r') {
  const hasSlash = value.startsWith('/') && !value.includes(' ');
  if (hasSlash) {
    return; // delegating to SlashListController
  } else {
    submitPrompt(value);
  }
  return;
}
```

**改进效果：**

| 改进 | 效果 |
|------|------|
| Windows 兼容 | 同时处理 `\r`（Carriage Return）和 `\n`（Line Feed） |
| 保留原有逻辑 | `key.return` 仍然有效 |
| 无性能损失 | 只是多一个条件判断 |

---

## 3. 文件变更清单

### 3.1 新增文件

| 文件 | 说明 | 复杂度 |
|------|------|--------|
| `App.tsx` | 根组件，纯粹组合 | ~30 行 |
| `AppController.ts` | 协调组件 | ~60 行 |
| `store/uiStore.ts` | Zustand UI 状态 | ~100 行 |
| `components/debug/debugStore.ts` | Zustand Debug 存储 | ~20 行 |
| `components/debug/useDebugController.ts` | Debug 控制器 | ~80 行 |
| `components/inputs/InputController.ts` | 输入控制器 | ~100 行 |
| `components/inputs/InputField.tsx` | 输入框渲染 | ~80 行 |
| `components/inputs/SlashListController.ts` | Slash 列表控制器 | ~120 行 |
| `hooks/useAppSession.ts` | Session 管理 | ~150 行 |
| `hooks/useAgentEvents.ts` | Agent 事件监听 | ~100 行 |

### 3.2 删除文件

| 文件 | 说明 | 替代 |
|------|------|------|
| `pi_app.tsx` | ~500 行巨型组件 | App.tsx + AppController.ts |
| `state/pi_app_reducer.ts` | ~200 行单一 reducer | uiStore.ts + modalStore.ts |
| `hooks/useDebug.ts` | useState 方式 debug | debugStore.ts |
| `hooks/useFocusOwner.ts` | 合并到组件逻辑 | - |
| `hooks/useWindowResize.ts` | 合并到组件逻辑 | - |

---

## 4. 架构演进路线

```
原架构 (7723aa4)
├── 巨型组件 pi_app.tsx
├── 单一 reducer
└── 内嵌输入处理

    ↓ 重构 (N11)

新架构
├── App.tsx (组合)
├── AppController.ts (协调)
├── store/
│   ├── uiStore.ts
│   └── debugStore.ts
└── components/
    ├── inputs/
    │   ├── InputController.ts
    │   └── SlashListController.ts
    └── debug/
        └── DebugPanel.tsx
```

---

## 5. 验收标准

- [x] `npm run build` 通过
- [x] 非 TTY 环境运行时显示友好错误消息并退出
- [x] slash 命令正常执行
- [x] 普通文本输入按 Enter 后正常提交
- [x] Debug Panel 可通过 Ctrl+P 打开
- [x] Debug 日志显示在 Debug Panel 中

---

## 6. TTY 知识

### 什么是 TTY

**TTY** = **Teletypewriter** (电传打字机)，指任何连接到程序的终端设备或会话。

### TTY vs Non-TTY

| 特性 | TTY | Non-TTY |
|------|-----|---------|
| 输入模式 | Raw mode（原始输入） | Cooked mode（行缓冲） |
| 按键捕获 | 单个按键 | 整行输入 |
| 典型场景 | 直接运行 | `echo x \| app`、SSH、cron |

### Non-TTY 典型场景

| 场景 | 示例 |
|------|------|
| 管道输入 | `echo "hello" \| npm start` |
| SSH 执行 | `ssh server npm start` |
| cron 任务 | 自动执行的脚本 |

---

## 7. Debug Panel 使用指南

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+P` | 打开/关闭 |
| `↑` / `↓` | 滚动 |
| `PgUp` / `PgDn` | 翻页 |
| `Home` / `End` | 首/末页 |

**添加 Debug 消息：**

```typescript
import { useDebugStore } from '../debug/debugStore.js';
useDebugStore.getState().addMessage('[Tag] message');
```

---

## 8. 参考文档

- [ROADMAP.md](../ROADMAP.md)
- [N1 新内核与 Ink 集成](./N1_新内核与Ink集成.md)
- [N3 会话生命周期与持久化基线](./N3_会话生命周期与持久化基线.md)
