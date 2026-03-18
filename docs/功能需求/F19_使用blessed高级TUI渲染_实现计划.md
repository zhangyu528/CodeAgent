# F19 使用blessed高级TUI渲染 - 实现计划

## 1. 目标 (Objective)

引入 blessed 库作为高级 TUI 渲染层，提供现代 CLI 界面体验。

**核心决策：**
- ❌ **不保留HUD**：不显示底部状态栏
- ❌ **无兼容性**：只使用blessed，移除纯文本fallback
- ✅ **解耦**：欢迎界面和REPL输入使用统一组件

## 2. 背景 (Background)

当前 CLI 使用原始的 console.log + readline 进行渲染，存在以下问题：
- 窗口大小改变时需要手动重绘
- 无动画支持
- 样式管理不够灵活
- 输入组件分散（欢迎用blessed，REPL用readline）

## 3. 技术方案

### 3.1 依赖安装

```bash
npm install blessed
npm install -D @types/blessed
```

### 3.2 目标架构

```
目标架构:
─────────────────────────────────────────────────
┌────────────────────────────────────────────────┐
│              InputManager (blessed)             │
│  ├── WelcomeScreen (欢迎)                       │
│  └── InputBox (输入框)                          │
│  → 统一管理输入，事件驱动                       │
└────────────────────────────────────────────────┘
         ↓  onCommand: (cmd) => void
┌────────────────────────────────────────────────┐
│              REPL (命令处理)                    │
│  └── 处理命令分发                               │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│              Core (Agent + Tools + LLM)        │
└────────────────────────────────────────────────┘
```

## 4. 实现计划

### Phase 1: 欢迎界面 ✅ 已完成

1. ✅ 安装 blessed 依赖
2. ✅ 创建 `blessed_welcome.ts`
3. ✅ Logo在上半部分，输入框在中间
4. ✅ 支持用户直接输入命令

### Phase 2: 统一输入组件 ✅ 已完成

**目标**: 创建 InputManager 统一管理输入，实现动态布局切换。

#### 4.1 创建 InputManager

**文件**: `src/apps/cli/components/input_manager.ts`

- ✅ 实现 `isWelcomeMode` 状态。
- ✅ 动态布局逻辑 (`updateLayout`)：首屏居中显示，输入后自动转为生产模式。
- ✅ 解决 `Ctrl+D` (EOF) 退出逻辑，支持全局监听。
- ✅ 解决水平居中问题 (`align: 'center'`)。

#### 4.2 核心职责

| 职责 | 说明 |
|------|------|
| 欢迎界面显示 | Logo + 版本 + Provider 信息，水平垂直居中 |
| 输入框管理 | blessed textbox，自适应布局 |
| 命令提交 | onCommand 事件，触发布局转换 |
| 退出处理 | Ctrl+C / q / Ctrl+D 全局退出 |

### Phase 3: 重构index.ts (解耦)

**目标**: 清晰的启动流程

```typescript
async function bootstrap() {
  // 1. 初始化Core
  const { controller, engine } = await createAgent(uiAdapter);
  
  // 2. 创建统一输入管理器
  const inputManager = new InputManager({
    provider: controller.getProviderName(),
    providers: engine.listProviders(),
    onCommand: handleCommand,
  });
  
  // 3. 启动输入
  inputManager.start();
}
```

### Phase 4: 简化REPL

- REPL专注于命令处理逻辑
- 输入由InputManager统一管理
- 事件驱动: Input → Command → Core → Output

## 5. 预期界面

```
┌─────────────────────────────────────────────────┐
│  ___            _        _                    _  │
│ / __|___  __| | ___   /_\  __ _ ___ _ _  __| │_ │
│| (__/ _ \/ _` |/ -_) / _ \/ _` / -_) ' \/ _`  _│
│ \___\___\__,_|\___|/_/ \_\__, \___|_||_\__,_\__│
│                           |___/                  │
│                                                  │
│ vdev                                             │
│ Provider: glm                                   │
│                                                  │
│ ❯ _ (blessed输入框，无HUD)                    │
└─────────────────────────────────────────────────┘
```

## 6. 兼容性决策

- ❌ **不保留HUD**：简洁模式
- ❌ **无纯文本fallback**：只支持blessed
- ❌ **不支持Git Bash**：仅Windows Terminal/PowerShell

## 7. 改动文件清单

| 文件 | 改动 | 阶段 |
|------|------|------|
| package.json | 添加blessed依赖 | Phase 1 ✅ |
| blessed_welcome.ts | 欢迎组件 | Phase 1 ✅ |
| input_manager.ts | 统一输入组件 | Phase 2 |
| index.ts | 解耦启动逻辑 | Phase 3 |
| repl.ts | 简化为命令处理器 | Phase 4 |

## 8. 状态

### Phase 1: 欢迎界面
- [x] 安装blessed依赖
- [x] 创建BlessedWelcome类
- [x] Logo在上半部分，输入框在中间
- [x] 用户可直接输入命令

### Phase 2: 统一输入组件
- [x] 创建InputManager类
- [x] 欢迎界面复用InputManager（居中布局）
- [x] 命令提交事件处理（触发布局转换）
- [x] 集成到index.ts
- [x] 全局支持 Ctrl+D 退出

### Phase 3: 重构index.ts
- [x] 解耦启动逻辑
- [ ] 完善命令执行逻辑

### Phase 4: 简化REPL
- [ ] REPL专注命令处理
- [ ] 事件驱动架构
