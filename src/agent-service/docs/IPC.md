# IPC 通信机制

## 概述

Agent Service 通过 Electron IPC 与 Renderer 通信，采用 `ipcMain.handle` / `ipcRenderer.invoke` 模式。

## 调用模式

```typescript
// Renderer → Preload → IPC Main → IPC Adapter → Service → Core
```

## IPC 通道列表

### Session 相关

| Channel | 方法 | 参数 | 返回值 |
|---------|------|------|--------|
| `agent:init` | `init()` | - | `{ success: boolean, sessionId: string \| null }` |
| `agent:hasActiveSession` | `hasActiveSession()` | - | `boolean` |
| `agent:getMessages` | `getMessages()` | - | `Message[]` |
| `agent:getSessionId` | `getSessionId()` | - | `string \| null` |
| `agent:listSessions` | `listSessions()` | - | `Session[]` |
| `agent:listSessionGroups` | `listSessionGroups()` | - | `SessionGroup` |
| `agent:newSession` | `createSession(name?)` | `name?: string` | `{ success, sessionId, sessionPath }` |
| `agent:newGlobalSession` | `createGlobalSession(name?)` | `name?: string` | `{ success, sessionId, sessionPath }` |
| `agent:newSessionForProject` | `createSessionForProject(cwd, name?)` | `cwd: string, name?: string` | `{ success, sessionId, sessionPath }` |
| `agent:switchSession` | `switchSession(path, cwd)` | `path: string, cwd: string` | `void` |
| `agent:deleteSession` | `deleteSession(path)` | `path: string` | `void` |
| `agent:renameSession` | `renameSession(path, name)` | `path: string, name: string` | `void` |
| `agent:prompt` | `prompt(text)` | `text: string` | `{ success, error? }` |

### Project 相关

| Channel | 方法 | 参数 | 返回值 |
|---------|------|------|--------|
| `agent:listProjects` | `listProjects()` | - | `Project[]` |
| `agent:activateProject` | `activateProject(path)` | `path: string` | `{ success }` |
| `agent:deleteProject` | `deleteProject(path)` | `path: string` | `void` |
| `agent:renameProject` | `renameProject(path, newName)` | `path: string, newName: string` | `void` |
| `agent:getCurrentCwd` | `getCurrentCwd()` | - | `string` |

### Model 相关

| Channel | 方法 | 参数 | 返回值 |
|---------|------|------|--------|
| `agent:getConfig` | `getConfig()` | - | `{ providers, currentModel }` |
| `agent:getProviders` | `getProviders()` | - | `Provider[]` |
| `agent:getModels` | `getModels(provider)` | `provider: string` | `Model[]` |
| `agent:setModel` | `setModel(model)` | `{ id: string, provider?: string }` | `void` |
| `agent:saveApiKey` | `saveApiKey(provider, key)` | `provider: string, key: string` | `{ success }` |
| `agent:removeApiKey` | `removeApiKey(provider)` | `provider: string` | `{ success }` |
| `agent:isFirstRun` | `isFirstRun()` | - | `boolean` |
| `agent:reloadProviders` | `reloadProviders()` | - | `{ success, providers }` |

### Context 相关

| Channel | 方法 | 参数 | 返回值 |
|---------|------|------|--------|
| `agent:getContextUsage` | `getContextUsage()` | - | `ContextUsage` |
| `agent:compact` | `compact(instructions?)` | `instructions?: string` | `{ success }` |
| `agent:setAutoCompaction` | `setAutoCompaction(enabled)` | `enabled: boolean` | `{ success }` |
| `agent:getAutoCompaction` | `getAutoCompaction()` | - | `boolean` |
| `agent:isCompacting` | `isCompacting()` | - | `boolean` |

### Events

| Channel | 方法 | 参数 |
|---------|------|------|
| `agent:event` | `onEvent(callback)` | `(event: AgentSessionEvent) => void` |

## 参数传递

IPC handler 参数解析：

```typescript
// electron-ipc.ts line 78-84
ipcMain.handle(channel, async (_event: any, ...args: any[]) => {
  return await handler(_event, ...args);
});

// handler 定义
handler: (_: any, sessionPath: string, projectCwd: string) => {
  return service.switchSession(sessionPath, projectCwd);
}
```

**注意**：第一个参数 `_` 是 `IpcMainInvokeEvent`，实际参数从第二个开始。

## 类型定义

详见 [API.md](./API.md)

## 日志

IPC 层有详细日志：

```bash
[preload] switchSession, path: xxx cwd: yyy
[IPC] agent:switchSession received, sessionPath: xxx projectCwd: yyy
[IPC wrapper] args: [...]
[Service] switchSession: xxx projectCwd: yyy
[Pool] activateSession: xxx projectCwd: yyy
```

## 测试

当前测试直接调用 `pool.ts` 函数，绕过 IPC 层。建议添加集成测试验证完整调用链。