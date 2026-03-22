# F14 架构重构实现计划：解耦 index.ts (God Object)

## 1. 目标 (Objective)
将 `src/index.ts` 中相互交织的职责进行拆分，从“全能文件”重构为“职责清晰的组件化架构”，提升代码的可维护性、可测试性及扩展性。

## 2. 当前问题 (Current Issues)
- **职责不清**: 一个文件同时处理了：启动引导、依赖注入（Factory）、UI 渲染逻辑、REPL 循环逻辑、按键绑定。
- **状态混乱**: `capturing`, `inputSuspended`, `processing` 等状态散落在顶级作用域，难以追踪和测试。
- **难以测试**: 由于逻辑强耦合了 `process.stdin/stdout` 和具体的 UI 实现，无法针对 REPL 流程编写高质量的单元测试。

## 3. 目标架构 (Target Architecture)

将逻辑拆分为以下四个核心模块：

### 3.1 `src/cli/factory.ts` (依赖工厂)
*   **职责**: 负责组装 `AgentController` 及其所有依赖（Engine, Providers, Tools, Security, Memory）。
*   **核心方法**: `createAgent(ui: UIAdapter): Promise<{controller, engine}>`。

### 3.2 `src/cli/terminal_manager.ts` (视图管理)
*   **职责**: 封装 `HUD` 和 `ToolBubbles`，提供高层级的 UI 更新接口。
*   **核心方法**: 
    *   `updateStatus(mode, tokens, ...)`
    *   `render(includeBubbles: boolean)`
    *   `suspend(fn: () => Promise<T>)`: 封装 `readline` 暂停与恢复逻辑。

### 3.3 `src/cli/repl.ts` (交互循环)
*   **职责**: 管理交互状态（正常模式 vs 捕获模式），处理用户输入的分发（Slash 命令 vs 普通 Prompt）。
*   **状态管理**: 使用一个 `REPLState` 类或闭包来封装 `capturing`, `processing` 等标志位。

### 3.4 `src/index.ts` (极简入口)
*   **职责**: 仅负责环境初始化（dotenv）并启动 REPL。
*   **代码量**: 预计缩减至 < 30 行。

## 4. 实施步骤 (Phased Implementation)

### 第一阶段：提取 Factory
1.  创建 `src/cli/factory.ts`。
2.  迁移 `createAgent` 函数及其相关的 Provider 注册、工具初始化逻辑。
3.  确保 `index.ts` 能够通过导入正常调用。

### 第二阶段：封装 TerminalManager
1.  创建 `src/cli/terminal_manager.ts`。
2.  将 `HUD` 和 `ToolBubbles` 的实例化及同步逻辑（如 `onThought` 时的 HUD 更新）移入此类。
3.  提供 `ui.suspendInput` 的标准实现。

### 第三阶段：重构 REPL 核心
1.  创建 `src/cli/repl.ts`。
2.  迁移 `readline` 的 `on('line')` 事件处理逻辑。
3.  迁移多行捕获（`<<EOF`）逻辑。
4.  将 `SlashCommand` 执行逻辑整合进 REPL 流程。

### 第四阶段：收尾与验证
1.  简化 `src/index.ts` 为纯粹的启动器。
2.  更新现有的集成测试，确保重构未破坏核心功能。
3.  针对新拆分的模块（特别是 Factory 和 REPL 状态逻辑）编写专项测试。

## 5. 验证与测试
1.  **回归测试**: 运行 `npm run test:all` 确保现有功能全绿。
2.  **交互测试**: 手动验证：
    *   `/` 触发斜杠菜单是否正常。
    *   多行输入（`<<EOF`）是否正常。
    *   Ctrl+C 中断是否正常。
3.  **类型检查**: `npx tsc --noEmit` 确保无类型引用错误。
