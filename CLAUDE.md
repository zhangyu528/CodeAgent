# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库工作时提供指导。

## 开发命令

### 构建和运行

- **开发**：`npm run dev` — 热重载开发模式运行 Ink CLI
- **构建**：`npm run build` — 使用 Bun 构建 CLI 到 dist/apps/cli/index.js
- **启动**：`npm start` — 运行构建后的 CLI 应用
- **全局安装**：`npm install -g` 后使用 `codeagent` 命令

### 测试

项目使用 Vitest 进行测试，测试文件位于 `tests/` 目录：

- 单元测试：`tests/unit/`
- 集成测试：`tests/integration/`

运行测试：

- `bun test` — 监听模式运行测试
- `bun run test:run` — 运行所有测试一次
- `bun run test:ui` — 带 UI 运行测试

## 架构概览

### 核心组件

1. **Agent 系统** (`src/agent/`)
   - 使用 `@mariozechner/pi-coding-agent` 的 `AgentSession` 单例
   - 基于 `createAgentSession` 的高级编程助手能力
   - 内置编码工具：read, write, edit (diff), bash, grep, find, ls
   - 多 Provider LLM 支持（OpenAI/Anthropic/Zhipu/Minimax）
   - 基于环境变量的模型解析器

2. **CLI 应用** (`src/apps/cli/`)
   - Ink TUI（终端用户界面）实现
   - 两个主要页面：Welcome Page 和 Chat Page
   - 结构化消息渲染，支持思维链分离
   - SQLite 持久化的会话管理

### 关键特性

- **会话持久化**：SQLite 存储于 `~/.codeagent/sessions.db`
- **斜杠命令**：`/help`、`/model`、`/new`、`/history`、`/resume`
- **人工确认**：敏感操作需要用户确认
- **网页工具**：搜索和页面浏览能力
- **内存管理**：Token 感知的滑动窗口（约 4000 tokens）

### 项目结构（六边形架构）

```
src/
├── agent/                    # Agent 核心业务逻辑
│   ├── agent.ts             # Agent 单例工厂
│   ├── model.ts             # LLM 模型解析
│   ├── sessions.ts          # 会话管理
│   ├── sessionRepository.ts # 会话存储抽象（N4）
│   └── tools/               # 执行工具
├── apps/cli/                 # Ink CLI 接口
│   ├── index.tsx            # CLI 入口
│   └── ink/                 # Ink 组件
│       ├── ink_app.tsx      # 主应用组件
│       ├── components/      # UI 组件
│       ├── hooks/           # React hooks
│       ├── pages/           # 页面组件
│       ├── store/           # 状态管理
│       └── context/         # React context
└── docs/                    # 文档和路线图
    ├── ideas/               # 功能提案
    │   ├── todo/           # 待实现任务
    │   └── completed/       # 已完成提案
    └── archive/            # 归档文档
        └── 新架构功能需求/  # N1-N12 需求文档
```

### 环境配置

复制 `.env.example` 到 `.env` 并配置：

- `DEFAULT_PROVIDER`：`zai` 或 `minimax`
- `{PROVIDER}_API_KEY`：对应 Provider 的 API Key
- 可选：`{PROVIDER}_MODEL`、`{PROVIDER}_BASE_URL`、`{PROVIDER}_API`

### 开发备注

- 使用 Bun 作为运行时（package.json 要求 `"bun": ">=1.3.0"`）
- 通过 tsconfig.json 配置 TypeScript
- Git 使用 LF 行尾（检查 .gitattributes）

### 当前状态（来自 ROADMAP.md）

**已完成的功能（N1-N4, N11-N12）**：

- ✅ N1: 新内核与 Ink TUI 集成
- ✅ N2: 多 Provider 支持与 Env 配置
- ✅ N3: 会话生命周期与持久化基线
- ✅ N4: 会话存储抽象与兼容迁移
- ✅ N11: Ink TUI 输入系统重构
- ✅ N12: 自动化测试方案

**已废弃的功能**：

- ❌ N5-N6, N7-N10：已被吸收或不再适用

### 自动化任务（cron jobs）

| Job 名称               | 职责                       | 频率    |
| ---------------------- | -------------------------- | ------- |
| `codeagent-optimizer`  | 代码质量分析 + 优化执行    | 每小时  |
| `codeagent-ideas-gen`  | 生成新功能提案             | 每6小时 |
| `codeagent-ideas-exec` | 执行选中的提案（TDD 方式） | 每6小时 |

### 重要约定

- AgentSession 是单例，使用 `getAgentSession()` 访问，底层 Agent 通过 `session.agent` 访问
- 使用 `ensureAgentInitialized()` 在启动时进行异步初始化
- 优先使用 `pi-coding-agent` 的内置编码工具
- UI 适配器通过订阅 `AgentSession` 获取事件流
- 会话数据由运行时拥有，跨重启持久化
