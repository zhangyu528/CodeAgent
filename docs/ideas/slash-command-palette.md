# 命令面板

## Problem Statement

CodeAgent 的斜杠命令系统目前采用静态注册 + 固定按键绑定，用户只能通过记忆或查看 `/help` 来发现可用命令。随着命令数量增长（N12 之后已有 5+ 命令，未来 MCP 工具注册表还会引入更多），这一模式的局限性日益明显：

1. **发现成本高** — 用户需要主动查阅帮助才能找到可用命令，无法在输入过程中即时发现
2. **无模糊搜索** — 当用户记得命令部分名称时（如 `mod` 记成 `model`），无法通过模糊匹配快速定位
3. **无快捷键覆盖** — Ink TUI 的 Tab 弹出仅支持固定选项，无法通过快捷键直达（如 `Cmd+K` 打开面板）
4. **命令链缺失** — 复合命令（如 `/refactor extract`）缺乏层级化的命令体系支撑
5. **工具注册表无入口** — MCP 动态发现的工具完全没有内置发现机制

结果：用户与 CLI 的交互效率受限于记忆成本，无法充分发挥 CodeAgent 的能力。

## Recommended Direction

**构建 CodeAgent 命令面板（Slash Command Palette）** — 借鉴 VS Code / Alfred 的命令面板模式，在 TUI 层提供统一的命令发现、搜索和执行入口。

### 核心交互设计

```
用户按下 Ctrl+K：
┌─ 🔍 命令面板 ──────────────────────────────┐
│  > _                                            │
├─────────────────────────────────────────────┤
│  📁 会话命令                                   │
│    /new        新建会话            ⌘N        │
│    /history    历史会话            ⌘H        │
│    /resume     恢复会话            ⌘R        │
│  ⚙️ 配置命令                                   │
│    /model      切换模型          ⌘M        │
│    /help       帮助              ⌘?        │
│  🔧 工具命令                                   │
│    /doctor     诊断检查                     │
│    /refactor   代码重构                     │
│  ...                                           │
└─────────────────────────────────────────────┘

用户在面板中输入 "mod"：
┌─ 🔍 命令面板 ──────────────────────────────┐
│  > mod                                        │
├─────────────────────────────────────────────┤
│  ⚙️ 配置命令                                   │
│    /model      切换模型          ⌘M        │
│  💡 相关建议                                 │
│    /models     查看可用模型                  │
└─────────────────────────────────────────────┘
```

### 模糊搜索算法

采用 Fuse.js 风格的模糊匹配：
- 支持前缀匹配（`/mod` → `/model`）
- 支持别名展开（`/h` → `/history`）
- 支持中文语义匹配（`"新建"` → `/new`）
- 结果按匹配分数排序，精确匹配优先

### 命令注册体系

```typescript
interface CommandDef {
  name: string;           // 唯一标识：'model'
  label: string;          // 显示名称：'切换模型'
  description: string;    // 功能描述
  keywords?: string[];    // 搜索关键词：['模型', 'provider', 'llm']
  shortcuts?: string[];   // 全局快捷键：['Cmd+M']
  category: CommandCategory;
  argsHint?: string;      // 参数提示：'<provider> [model]'
  handler: (args: string) => Promise<void>;
}

// 注册优先级
const PALETTE_COMMANDS: CommandDef[] = [
  // 内置命令（静态注册）
  // MCP 工具（动态注册）
  // 用户自定义（配置注入）
];
```

## Key Assumptions to Validate

- [ ] **假设 1**：Fuse.js 模糊搜索库在 CLI 环境下可用（无 DOM 依赖）
  *验证方法*：检查 npm 包是否支持 Bun/Node 纯 JS 环境
- [ ] **假设 2**：Ink TUI 支持全局键盘监听（Ctrl+K）而不干扰输入框焦点
  *验证方法*：在 `App.tsx` 中测试 raw mode 键盘捕获
- [ ] **假设 3**：用户确实需要命令面板而非单纯依赖 Tab 补全
  *验证方法*：在现有用户中做 5 人调研，对比 Spotlight 风格 vs Tab 补全的偏好

## MVP Scope

**做：**
1. `src/apps/cli/ink/components/CommandPalette.tsx` — 面板组件
   - 搜索输入框（带光标）
   - 分类结果列表
   - 键盘导航（↑↓ 选择，Enter 执行，Esc 关闭）
   - 快捷键提示渲染
2. `src/apps/cli/ink/hooks/useCommandPalette.ts` — 面板状态管理
   - `isOpen`, `query`, `results`, `selectedIndex`
   - Fuse.js 初始化和搜索逻辑
3. `src/apps/cli/ink/hooks/useGlobalShortcuts.ts` — 全局快捷键监听
   - `Ctrl+K` 打开面板
   - `Escape` 关闭面板
4. 命令注册表扩展 — 将现有 5 个命令 + 未来 MCP 命令统一注册
5. 面板样式 — 与 Ink 主题系统集成，深浅终端均清晰可读
6. 单元测试：`useCommandPalette` 的搜索过滤、快捷键响应

**不做：**
- 命令链（`/refactor extract`）语法解析（属于 `conversational-refactor` 提案范围）
- 命令别名自定义配置（v2 范围）
- 面板结果缓存（每次打开重新搜索）
- 模糊匹配算法自定义（直接使用 Fuse.js）

## Not Doing (and Why)

- **命令链解析** — 属于 `/refactor` 的专属交互设计，不应在通用面板层面处理
- **用户自定义别名** — v2 功能，需要配置持久化，MVP 只做内置命令
- **面板内直接编辑参数** — 复杂度高，MVP 只执行命令，参数由命令处理器自行处理
- **历史使用频率排序** — 需要持久化统计，增加状态复杂度；MVP 按静态优先级 + 匹配分数排序

## Open Questions

1. 命令面板是否应该在输入框有内容时自动触发（如输入 `/` 时），还是仅通过 `Ctrl+K` 触发？
2. 快捷键 `Ctrl+K` 是否与其他工具冲突（如 tmux 的窗格切换）？是否应该提供可配置的快捷键？
3. MCP 动态发现的工具如何映射到命令分类 — 是否需要 MCP 注册时声明 category？
4. 面板是否应该显示最近使用的命令（类似 VS Code 的 "Recent" 区域）？
5. 当只有一个精确匹配结果时，是否应该直接执行而非显示面板？
