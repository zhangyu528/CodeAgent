# F19 使用 Blessed 高级 TUI 渲染 - 实现状态更新

## 1. 目标

将 CLI 收敛为 **Blessed 单栈**：
- 输入、渲染、交互审批、Slash 命令统一在 Blessed UI 中完成。
- 移除运行时 UIAdapter 动态切换。
- 主路径不再依赖 REPL/readline 交互循环。

## 2. 当前架构（已落地）

```
┌────────────────────────────────────────────────┐
│          InputManager (Blessed TUI)            │
│  ├── Welcome Mode                              │
│  ├── Chat Mode                                 │
│  ├── Slash Popup                               │
│  └── BlessedUIAdapter (IUIAdapter impl)        │
└────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│      AgentController + LLMEngine + Tools       │
└────────────────────────────────────────────────┘
```

## 3. 启动链路（现状）

`src/apps/cli/index.ts`：
1. 校验 Blessed 终端支持（`TERM != dumb` 或 `FORCE_BLESSED=1`）。
2. 先创建 `InputManager`。
3. 使用 `inputManager.getBlessedUIAdapter()` 创建 Agent。
4. 将 runtime 通过 `attachRuntime(...)` 绑定回 `InputManager`。
5. 启动 `inputManager.start()`。

## 4. 已完成项

- [x] 主路径移除 `TTY_UIAdapter`。
- [x] Controller 会话期 UIAdapter 固定，不再在请求中 `setUIAdapter` 切换。
- [x] Slash 执行上下文统一走 Blessed `ui`，不再 `console.log` 直写输出。
- [x] `/model` 在模型列表为空时，改为 `ctx.ui.ask(...)`（Blessed 内输入）。
- [x] `InputManager` 成为 CLI UI 单一事实来源。

## 5. 兼容策略

- Blessed 不可用时直接退出并提示，不隐含 REPL fallback。
- `repl.ts` 与 `blessed_welcome.ts` 已从主工程移除，不再参与构建与运行。

## 6. 相关文件

- `src/apps/cli/index.ts`
- `src/apps/cli/components/input_manager.ts`
- `src/apps/cli/components/slash_commands.ts`
- (removed) `src/apps/cli/components/repl.ts`
- (removed) `src/apps/cli/components/blessed_welcome.ts`


- Input area now includes a minimal model line under textbox: Model: provider/model.
