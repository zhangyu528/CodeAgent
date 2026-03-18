**Title**  
调整 CLI 欢迎横幅：彩色图案、包含版本与 Provider，极简显示

**Summary**  
- 将欢迎区改为居中显示的卡片布局（使用 `blessed` 库实现）。
- 欢迎卡片在垂直和水平方向均居中显示，提供现代 TUI 体验。
- 仅展示产品名+版本、当前 Provider 及可用 Provider 列表。
- 移除状态栏显示说明和 /help 命令提示，保持界面清爽。
- 布局逻辑：初始进入为居中“欢迎模式”，提交首个命令后自动切换为标准“工作模式”。

**Implementation Changes**  
- `src/apps/cli/components/input_manager.ts`:
  - `isWelcomeMode`: 维护初始欢迎状态。
  - `updateLayout`: 动态调整组件位置。欢迎模式下隐藏输出框，将 Logo 和输入框居中；工作模式下恢复顶部 Logo、中间输出、底部输入。
  - `logoBox`：使用 `align: 'center'` 确保 ASCII Logo 和文字水平居中。
  - `buildLogoContent`：包含版本号、Provider 信息及快捷键提示。
- `src/apps/cli/components/blessed_welcome.ts`:
  - 同样支持居中布局和 `align: 'center'`，作为独立组件备用。
- 版本号从 `package.json` 读取；若失败则显示 `dev`。


**Test Plan**  
- 手动启动 `npm start`：首屏出现彩色图案 + 极简文本；版本与 Provider 之间有空行；无多余说明行。  
- 非 TTY 启动：欢迎输出不因颜色报错（NO_COLOR=1 时正常降级）。  
- 运行 `npm run test:unit` 确认未破坏现有单测。

**Assumptions**  
- 版本号从 `package.json` 读取；若失败则显示 `dev`。  
- 终端支持基本 ANSI 颜色；在 NO_COLOR 或不支持的场景下回退为单色文本。  
- 欢迎输出行数维持 4 行，不额外添加 workspace/快捷键信息。
