**Title**  
调整 CLI 欢迎横幅：彩色图案、包含版本与 Provider，极简显示

**Summary**  
- 将欢迎区改为“左侧彩色图案 + 右侧文本”卡片。  
- 仅展示产品名+版本、当前 Provider 及可用 Provider 列表。
- 移除状态栏显示说明和 /help 命令提示，保持界面清爽。
- 版本信息与 Provider 信息之间增加空行间隔。

**Implementation Changes**  
- `src/index.ts`:  
  - `renderWelcomeCard`：左侧图案用 3~4 种颜色渐变，右侧文字保持单色。  
  - 右侧文本行设计：  
    1) `CodeAgent CLI v<version>`（粗体 cyan）  
    2) (空行)
    3) `Provider: <default> (可用: …)`（cyan）  
  - 移除状态栏显示说明（"状态栏显示 Mode/Token/Last Tool"）。
  - 移除帮助信息提示（"输入 /help 查看全部命令与配置开关"）。
  - 版本号从 `package.json` 读取；若失败则显示 `dev`。  
  - 确保颜色调用集中在欢迎渲染，不影响 HUD/流式输出。  
- 若引入颜色工具：复用现有 `chalk`，不增加新依赖。

**Test Plan**  
- 手动启动 `npm start`：首屏出现彩色图案 + 极简文本；版本与 Provider 之间有空行；无多余说明行。  
- 非 TTY 启动：欢迎输出不因颜色报错（NO_COLOR=1 时正常降级）。  
- 运行 `npm run test:unit` 确认未破坏现有单测。

**Assumptions**  
- 版本号从 `package.json` 读取；若失败则显示 `dev`。  
- 终端支持基本 ANSI 颜色；在 NO_COLOR 或不支持的场景下回退为单色文本。  
- 欢迎输出行数维持 4 行，不额外添加 workspace/快捷键信息。
