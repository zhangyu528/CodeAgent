# F19 使用blessed高级TUI渲染 - 实现计划

## 1. 目标 (Objective)

引入 blessed 库作为高级 TUI 渲染层，提供现代 CLI 界面体验，替代当前简单的 console.log 渲染方式。

## 2. 背景 (Background)

当前 CLI 使用原始的 console.log 进行渲染，存在以下问题：
- 窗口大小改变时需要手动重绘
- 无动画支持
- 样式管理不够灵活
- 无窗口系统，布局需要手动计算

blessed 是一个现代 TUI 库，提供：
- 窗口/面板系统
- 自动布局管理
- Partial Update（只更新变化部分）
- 组件化开发
- 丰富的样式系统

## 3. 技术方案

### 3.1 依赖安装

```bash
npm install blessed
npm install -D @types/blessed
```

### 3.2 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    Screen (blessed)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Welcome Container                     │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │           ASCII Logo (上半部分)            │  │   │
│  │  └─────────────────────────────────────────┘  │   │
│  │              Version + Provider Info             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Input Box (中间位置)                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.3 核心组件

#### BlessedWelcome 类

```typescript
export class BlessedWelcome {
  private screen: blessed.Screen;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'CodeAgent CLI',
    });
  }

  render(data: WelcomeData, onSubmit: (input: string) => void) {
    // Logo在上半部分
    // 输入框在中间位置 (top: '50%')
    // 用户可以直接输入命令
  }

  destroy() {
    this.screen.destroy();
  }
}
```

### 3.4 欢迎界面布局

- **Logo位置**：上半部分
- **输入框位置**：中间位置 (50%)
- **无HUD显示**：简洁的欢迎界面
- **用户交互**：直接输入命令，按回车执行

## 4. 实现计划

### Phase 1: 欢迎界面改造 ✅ 已完成

1. ✅ 安装 blessed 依赖
2. ✅ 创建 `src/apps/cli/components/blessed_welcome.ts`
3. ✅ 实现 BlessedWelcome 类
4. ✅ Logo在上半部分，输入框在中间
5. ✅ 支持用户直接输入命令
6. ✅ 集成到 index.ts

### Phase 2: 状态栏升级（待定）

1. 将 HUD 迁移到 blessed Box
2. 利用 blessed 的布局系统

### Phase 3: 交互增强（待定）

1. 添加加载动画（spinner）
2. 添加进度条组件

## 5. 兼容性

### 支持的环境

| 环境 | 支持情况 |
|------|---------|
| Windows Terminal | ✅ 完全支持 |
| PowerShell | ✅ 支持 |
| CMD | ✅ 支持 |
| Linux / Mac Terminal | ✅ 完全支持 |

### 不支持的环境

| 环境 | 说明 |
|------|------|
| Git Bash / MSYS2 | 不支持，需要使用 Windows Terminal |

### Fallback 方案

如果 blessed 不可用（如检测到 Git Bash），回退到纯文本模式：

```typescript
export function isBlessedSupported(): boolean {
  const isDumb = process.env.TERM === 'dumb';
  const hasValidTerm = process.env.TERM && process.env.TERM !== 'dumb';
  return Boolean(hasValidTerm);
}
```

## 6. 风险与注意事项

1. **Windows Git Bash**：需要提示用户使用 Windows Terminal
2. **依赖增加**：blessed 是额外依赖
3. **样式兼容性**：不同终端样式可能有差异
4. **保留原有逻辑**：blessed 仅用于展示，核心逻辑保持不变

## 7. 改动文件清单

| 文件 | 改动 | 状态 |
|------|------|------|
| package.json | 添加 blessed 依赖 | ✅ |
| src/apps/cli/components/blessed_welcome.ts | 新建 blessed 欢迎组件 | ✅ |
| src/apps/cli/index.ts | 集成 blessed 渲染 | ✅ |
| src/apps/cli/components/terminal_manager.ts | 支持 resize 重绘 | ✅ |
| src/apps/cli/components/welcome_card.ts | 保留纯文本 fallback | ✅ |

## 8. 使用说明

### 启动流程

1. CLI启动 → 检测终端是否支持blessed
2. 如果支持 → 显示blessed欢迎界面（Logo + 输入框）
3. 用户输入命令 → 按回车执行 → 进入REPL
4. 如果不支持 → 使用纯文本欢迎界面

### 预期界面

```
┌─────────────────────────────────────────────────────────┐
│  ___            _        _                    _         │
│ / __|___  __| | ___   /_\  __ _ ___ _ _  __| |_      │
│| (__/ _ \/ _` |/ -_) / _ \/ _` / -_) ' \/ _`  _|    │
│ \___\___\__,_|\___|/_/ \_\__, \___|_||_\__,_\__|     │
│                           |___/                        │
│                                                          │
│ vdev                                                 │
│ Provider: glm (Available: glm...)                     │
│                                                          │
│ > _ (输入框在中间位置)                                 │
└─────────────────────────────────────────────────────────┘
```

## 9. 状态

- [x] 安装 blessed 依赖
- [x] 创建 BlessedWelcome 类
- [x] 集成到 CLI 启动流程
- [x] Logo在上半部分，输入框在中间
- [x] 用户可直接输入命令
- [x] Fallback 支持
