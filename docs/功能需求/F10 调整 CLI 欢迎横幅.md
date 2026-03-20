**Title**
调整 CLI 欢迎横幅：Ink 驱动的居中落地页与状态卡片

**Summary**
- 欢迎页采用现代“落地页”设计，核心内容在屏幕垂直水平居中。
- 引入青色 (Cyan) 高亮 ASCII Logo 增强品牌感。
- 核心状态信息（版本、Provider、Workspace）通过圆角边框卡片集中展示。
- **输入框居中**: Welcome 模式下，输入框随欢迎内容一起居中，形成视觉焦点。

**Implementation Changes**
- `src/apps/cli/ink/components/ui_blocks.tsx`:
  - `WelcomePage`: 使用 Ink Flexbox 实现全自动居中布局。
  - `Status Card`: 新增带边框的信息容器，区分核心数据与背景引导。
  - `Action Hints`: 对 `/history`、`/help` 等关键词进行标色，提升引导性。
  - `InputBar`: 
    - 欢迎模式下边框色为 `cyan`，聊天模式下为 `gray`。
    - 底部提示语根据当前模式动态切换。
- `src/apps/cli/ink/app.tsx`:
  - 动态渲染逻辑：Welcome 模式下将 `InputArea` 作为 `WelcomePage` 的子组件渲染（实现居中）；Chat 模式下单独渲染在容器底部。

**Test Plan**
- 启动 CLI：首页 Logo 为青色，所有文字与输入框在屏幕正中对齐。
- 输入内容并回车：布局自动切换，输入框下沉至屏幕底部，顶部切换为 Chat Header。
- 验证 Resize：调整窗口大小时，欢迎页内容始终保持在屏幕中央。

**Assumptions**
- 终端支持基本 ANSI 颜色以显示青色 Logo。
- 最小终端行数建议为 12 行，以完整展示居中卡片。
