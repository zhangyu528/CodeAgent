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
│  ├── Smart Slash Hint (SlashCommandPopup)      │
│  ├── Select Modal (/model,/provider)           │
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
2. 创建 `InputManager`。
3. 使用 `inputManager.getBlessedUIAdapter()` 创建 Agent。
4. 将 runtime 通过 `attachRuntime(...)` 绑定回 `InputManager`。
5. 启动 `inputManager.start()`。

## 4. 当前界面行为

- [x] `/model`、`/provider` 使用居中弹框选择（`↑/↓`、`Enter`、`Esc`）。
- [x] 输入区域为 Slate 极简风：暗背景、低饱和边框、更窄宽度（welcome 64%，chat 72%）。
- [x] 输入框同组件内显示模型行：`Model: provider/model`，并在切换后即时同步。
- [x] 输入框支持 placeholder：空输入显示、输入后隐藏、清空后回显。
- [x] **Smart Slash Hint**: 输入 `/` 自动弹出命令建议列表，支持 `↑/↓` 选择，`Enter/Tab` 补全。
- [x] Slash 执行上下文统一走 Blessed `ui`，不再直写 stdout。
- [x] Controller 会话期 UIAdapter 固定，不再在请求中 `setUIAdapter` 切换。

## 5. 欢迎页信息（当前）

- 显示：ASCII Logo、`版本号: <version>`、`执行/授权路径: <cwd>`。
- 不再显示：Provider 列表、快捷键说明。
- 版本号读取失败时回退为 `unknown`。

## 6. 兼容策略

- Blessed 不可用时直接退出并提示，不隐含 REPL fallback。
- `repl.ts` 与 `blessed_welcome.ts` 已从主工程移除，不再参与构建与运行。

## 7. 相关文件

- `src/apps/cli/index.ts`
- `src/apps/cli/components/input_manager.ts`
- `src/apps/cli/components/slash_popup.ts`
- `src/apps/cli/components/slash_commands.ts`
- (removed) `src/apps/cli/components/repl.ts`
- (removed) `src/apps/cli/components/blessed_welcome.ts`
