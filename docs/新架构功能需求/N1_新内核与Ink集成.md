# 功能需求 N1：新内核与 Ink 集成 (Pi-Agent Era)

## 概述
CodeAgent 现已迁移至基于 `@mariozechner/pi-agent-core` 的新内核，并采用 `Ink` (React for CLI) 构建全新的 TUI。此架构实现了核心逻辑（Runtime）与展示层（UI）的彻底解耦。

## 核心特性

### 1. 六边形架构 (Hexagonal Architecture)
- **Core Logic**: 封装在 `src/core/pi` 中，不依赖任何 UI 库。
- **UI Adapter**: 基于 `Ink` 的实现位于 `src/apps/cli/ink`。
- **通信**: 通过 `Agent` 类进行状态订阅与指令下发。

### 2. Ink-based TUI
- **组件化**: 使用 React 组件构建界面，包含 `WelcomePage`、`ChatPage`、`InputArea` 等。
- **交互式 Overlay**: 支持居中的弹出层，用于模型选择、确认对话框等。
- **响应式布局**: 自动监听终端尺寸变化并重新渲染。
- **Slash Commands**: 输入 `/` 触发命令菜单，支持分类显示与实时预览。
- **结构化 Chat 视图**: chat 页面已从平铺文本流演进为消息块视图，用户、助手、系统与错误消息分开显示，`thinking` 从最终回答正文中剥离。

### 3. 会话管理 (Session Management)
- **持久化**: 会话以 JSON 格式存储在 `~/.codeagent/sessions/`。
- **自动保存**: 每一轮对话结束时自动保存会话状态。
- **历史回溯**: 支持查看历史会话并随时 `/resume` 或通过 `/history` 手动选择。

### 4. 核心工具集 (Core Tools)
- `list_directory`: 结构化目录列表。
- `read_file`: 读取文件内容。
- `write_file`: 写入文件内容。
- `run_command`: 执行本地 Shell 命令。

### 5. 多模型支持
- 内置支持 Zhipu (zai)、Minimax、OpenAI、Anthropic 等主流 Provider。
- 支持通过环境变量 `{PROVIDER}_BASE_URL` 动态配置 API 端点。
- 支持运行时通过 `/model` 命令交互式切换模型。

## 下一步计划
- [ ] 实现代码 Diff 可视化渲染。
- [ ] 增强 `run_command` 的实时输出捕获。
- [ ] 集成 `web_search` 与 `browse_page` 工具到新内核。
- [ ] 为结构化 Chat 视图补充工具摘要块与更完整的交互能力。
