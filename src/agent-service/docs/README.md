# Agent Service

AI Agent 核心服务层，提供 Session 管理、Project 管理、Model 配置等功能。

## 目录结构

```
agent-service/
├── src/
│   ├── adapters/          # IPC 适配器
│   │   └── electron-ipc.ts
│   ├── core/              # 核心功能
│   │   ├── auth/          # 认证
│   │   ├── model/         # 模型配置
│   │   ├── project/       # 项目管理
│   │   └── session/       # Session 管理
│   ├── services/         # 服务层
│   │   ├── service.ts     # AgentService 实现
│   │   └── types.ts      # 类型定义
│   └── index.ts
├── tests/                 # 测试
├── docs/                  # 文档
└── package.json
```

## 快速开始

```typescript
import { createAgentService } from './src/index.js';

const service = await createAgentService();

// 初始化
const { success, sessionId } = await service.init();

// 发送消息
await service.prompt('你好');

// 获取消息
const messages = service.getMessages();
```

## 服务分类

- **Session 管理** - 会话的创建、切换、删除
- **Project 管理** - 项目目录管理
- **Model 管理** - LLM 配置、API Key
- **Context 管理** - 上下文压缩
- **Events** - 实时事件订阅

## 详细文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 系统架构
- [IPC.md](./IPC.md) - IPC 通信机制
- [SESSION.md](./SESSION.md) - Session 管理
- [MODEL.md](./MODEL.md) - 模型配置
- [CONTEXT.md](./CONTEXT.md) - Context 管理