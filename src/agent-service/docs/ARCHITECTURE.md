# 系统架构

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer (UI)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    App     │  │  sidebar    │  │   chat      │         │
│  └─────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│        │                │                │                 │
│        └────────────────┼────────────────┘                 │
│                         │ api.ts                          │
└─────────────────────────┼─────────────────────────────────┘
                          │ IPC (contextBridge)
┌─────────────────────────┼─────────────────────────────────┐
│                    Preload                                 │
│              ipcRenderer.invoke()                         │
└─────────────────────────┼─────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│                  Main Process                              │
│                   ipcMain.handle()                         │
└─────────────────────────┼─────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│                  IPC Adapter                               │
│            createElectronIpcAdapter()                      │
└─────────────────────────┼─────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│                  Agent Service                             │
│                    service.ts                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ session  │  │ project  │  │  model   │  │ context  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       └─────────────┼─────────────┼─────────────┘        │
│                     └─────────────┼───────────────────────-┘
└─────────────────────────┼─────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│                    Core Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ session/ │  │ project/ │  │  model/  │  │  auth/   │ │
│  │  pool   │  │ registry │  │ registry │  │ storage  │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │
│                                                             │
│            @mariozechner/pi-coding-agent                    │
└─────────────────────────────────────────────────────────────┘
```

## 模块说明

### Renderer (UI Layer)
- React 组件渲染
- 通过 `api.ts` 调用 IPC

### Preload
- `contextBridge.exposeInMainWorld('agent', ...)`
- 安全地暴露 API 到渲染进程

### IPC Adapter
- `electron-ipc.ts`
- 将 IPC 调用转发到 Service 层
- 参数验证和日志

### Agent Service
- `service.ts`
- 业务逻辑编排层
- 返回值统一封装为 `{ success, ... }`

### Core Layer
- `session/pool.ts` - Session 生命周期管理
- `project/registry.ts` - 项目注册表
- `model/registry.ts` - 模型注册表
- `auth/storage.ts` - API Key 存储

## IPC 调用流程

```typescript
// 1. Renderer
const result = await agent.switchSession(path, cwd);

// 2. Preload (preload/index.ts)
ipcRenderer.invoke('agent:switchSession', path, cwd);

// 3. IPC Main (electron-ipc.ts wrapper)
ipcMain.handle('agent:switchSession', async (event, ...args) => {
  return await handler(event, ...args);
});

// 4. IPC Adapter Handler
handler: (_: any, sessionPath: string, projectCwd: string) => {
  return service.switchSession(sessionPath, projectCwd);
}

// 5. Service
async switchSession(sessionPath: string, projectCwd: string) {
  await activateSession(sessionPath, projectCwd);
}

// 6. Pool
export async function activateSession(sessionPath: string, _projectCwd: string)
```

## 数据流

### Session 数据流
```
User clicks session
    → handleSwitchSession(session.path, session.cwd)
    → ipcRenderer.invoke('agent:switchSession', path, cwd)
    → IPC handler → service.switchSession()
    → pool.activateSession()
    → sessionManager.switchSession() (SDK)
    → session file loaded
    → getMessages() returns messages from session
```

### Message 数据流
```
User sends message
    → handleSubmit(text)
    → agent.prompt(text)
    → service.prompt(text)
    → agent.prompt() (SDK)
    → AI generates response
    → Events emitted via session.subscribe()
    → Renderer receives events via onEvent()
```

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/adapters/electron-ipc.ts` | IPC 处理器注册 |
| `src/services/service.ts` | 业务逻辑 |
| `src/core/session/pool.ts` | Session 生命周期 |
| `src/core/project/registry.ts` | 项目注册 |
| `src/core/model/registry.ts` | 模型注册 |