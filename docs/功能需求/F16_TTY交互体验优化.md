# F16 TTY 交互体验优化实现计划 (F16_TTY优化_实现计划) - [DONE]

## 1. 目标 (Objective)
深度优化 TTY 终端下的按键交互行为，使其符合主流 IDE 终端（如 VSCode Terminal）和现代 CLI 工具的操作直觉。

## 2. 交互逻辑重映射

### 2.1 按键功能调整
| 按键 | 当前行为 | 优化后行为 |
| :--- | :--- | :--- |
| **Ctrl + C** | 中断运行 / 提示退出 | **立即退出** (Exit) 程序 |
| **ESC** | 无特殊动作 | **中断/取消**: 中断流式输出、取消多行捕获、清空当前行输入 |
| **Ctrl + D** | 退出程序 | 保持不变 (Unix 标准) |
| **F9** | 无 | **切换状态栏**: 动态显示/隐藏底部的 HUD |

### 2.2 交互菜单行为 (Inquirer)
在 `/model`, `/provider` 或 `/` 弹出菜单时：
*   **ESC**: 立即关闭菜单并返回 `CodeAgent >` 提示符，不产生任何副作用。
*   **Ctrl + C**: 立即强杀程序并退出。

## 3. 其它潜在优化点 (TTY Enhancements)
*   **输入框快捷键**: 支持 `Alt + Backspace` 删除整词，`Ctrl + A / E` 跳转行首行尾。
*   **智能粘贴处理**: 优化大段文本粘贴到终端时的处理逻辑，防止触发大量中间重绘。
*   **窗口缩放自适应**: 监听 `resize` 事件，自动调整分隔线宽度和 HUD 布局。

## 4. 技术方案

### 4.1 `src/cli/keybindings.ts`
*   修改 `onKeypress` 处理函数：
    *   识别 `key.ctrl && key.name === 'c'` 调用 `onExit()`。
    *   识别 `key.name === 'escape'`：
        *   若 `isCapturing()`，执行 `cancelCapture()`。
        *   若 `getMode() === 'STREAMING' / 'THINKING'`，执行 `abortCurrent()`。
        *   否则，清空 `rl.line`。
    *   识别 `key.name === 'f9'`，调用新的回调 `onToggleHUD()`。

### 4.2 `src/cli/terminal_manager.ts`
*   新增 `toggleHUD()` 方法，支持动态切换 `hud.enabled` 状态并重新渲染。
*   监听 `process.stdout.on('resize', ...)` 事件。

### 4.3 `src/cli/repl.ts`
*   优化 `handleSlash` 和 `showSlashMenu` 的错误处理：
    *   在捕获到 `inquirer` 的取消异常（ESC）时，静默返回并执行 `refreshInputArea()`。

## 5. 验收标准
1.  按 `Ctrl+C` 无论在什么状态下都应立即安全退出。
2.  在流式输出时按 `ESC` 应立即停止输出并返回等待输入状态。
3.  在普通输入时按 `ESC` 应清空已输入的文字。
4.  在弹出命令菜单时按 `ESC` 菜单消失且不退出程序。
5.  按 `F9` 能够即时开启/关闭底部状态栏。
