# F19 使用 Ink (React) 现代 TUI 渲染 - 实现状态更新

## 1. 目标

将 CLI 从 Blessed 迁移至 **Ink (React-based TUI)** 栈：
- 利用 React 的状态驱动模型管理复杂的 UI 交互。
- 统一输入、渲染、交互审批、Slash 命令在 Ink 组件中完成。
- 提供更现代、更易扩展的 TUI 开发体验。

## 2. 当前架构（已落地）

```
┌────────────────────────────────────────────────┐
│             InkApp (React Context)             │
│  ├── WelcomePage (Landing Layout)              │
│  ├── ChatPage (Message Stream)                 │
│  ├── InputArea (Unified Input Container)       │
│  │    ├── InputBar (Visual Input Box)          │
│  │    ├── SlashPalette (Anchored Floating UI)  │
│  │    └── HistoryPicker (Anchored Floating UI) │
│  └── InkUIAdapter (IUIAdapter implementation)  │
└────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│      AgentController + SessionService          │
└────────────────────────────────────────────────┘
```

## 3. 核心界面行为

- [x] **动态布局**: Welcome 模式下 Logo、信息卡片和输入框整体居中；Chat 模式下输入框固定在底部。
- [x] **跟随式弹出层**: `SlashPalette` 和 `HistoryPicker` 使用绝对定位锚点，在 Welcome 模式显示在输入框下方，Chat 模式显示在输入框上方。
- [x] **智能提示强化**: 列表包含命令分类 (Category)、用法 (Usage)，并支持实时字符匹配高亮。
- [x] **交互回退**: 按下 `Esc` 可隐藏提示列表，继续打字自动恢复显示。
- [x] **响应式设计**: 自动处理终端 Resize 事件，自适应布局宽度。

## 4. 欢迎页设计

- **视觉**: 青色 (Cyan) 高亮 ASCII Logo。
- **信息卡片**: 使用边框封装版本号、Provider 和 Workspace 路径。
- **居中输入**: 输入框作为 `WelcomePage` 的子组件，随内容整体垂直水平居中。

## 5. 相关文件

- `src/apps/cli/index.ts` (Entry point)
- `src/apps/cli/ink/app.tsx` (Main UI Logic)
- `src/apps/cli/ink/components/ui_blocks.tsx` (UI Components)
- `src/apps/cli/ink/ink_ui_adapter.ts` (Bridge)
- `src/core/session/service.ts` (Session persistence)
- (removed) `src/apps/cli/components/input_manager.ts` (Old Blessed impl)
- (removed) `src/apps/cli/components/slash_popup.ts` (Old Blessed impl)
