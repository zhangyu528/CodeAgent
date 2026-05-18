# Agent Service API 参考

## AgentService 接口

```typescript
interface AgentService {
  // Init
  init(): Promise<{ success: boolean; sessionId: string | null }>;

  // Session
  hasActiveSession(): boolean;
  prompt(promptText: string): Promise<{ success: boolean; error?: string }>;
  getMessages(): any[];
  getSessionId(): string | null;
  listSessions(): Promise<SessionInfo[]>;
  listSessionGroups(): Promise<SessionGroup>;
  createSession(name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string }>;
  createGlobalSession(name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string }>;
  createSessionForProject(cwd: string, name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string }>;
  switchSession(sessionPath: string, projectCwd: string): Promise<void>;
  deleteSession(sessionPath: string): Promise<void>;
  renameSession(sessionPath: string, newName: string): Promise<void>;

  // Project
  listProjects(): Project[];
  activateProject(path: string): Promise<{ success: boolean }>;
  deleteProject(path: string): void;
  renameProject(path: string, newName: string): void;
  getCurrentCwd(): string;

  // Model
  getConfig(): Promise<{ providers: Provider[]; currentModel: string | null }>;
  getProviders(): Promise<Provider[]>;
  getModels(provider: string): Promise<Model[]>;
  setModel(model: { id: string; provider?: string }): Promise<void>;
  saveApiKey(provider: string, apiKey: string): Promise<{ success: boolean }>;
  removeApiKey(provider: string): Promise<{ success: boolean }>;
  isFirstRun(): Promise<boolean>;
  reloadProviders(): Promise<{ success: boolean; providers?: string[] }>;

  // Context
  getContextUsage(): ContextUsage;
  compact(instructions?: string): Promise<{ success: boolean }>;
  setAutoCompaction(enabled: boolean): Promise<{ success: boolean }>;
  getAutoCompaction(): Promise<boolean>;
  isCompacting(): Promise<boolean>;

  // Stats
  getSessionStats(): any;
  getThinkingLevel(): Promise<ThinkingLevel>;
  setThinkingLevel(level: string): void;
  cycleThinkingLevel(): Promise<{ success: boolean; level?: string }>;

  // Control
  abort(): void;

  // Events
  onEvent(callback: (event: AgentSessionEvent) => void): () => void;

  // Platform
  getAgentHome(): string;
}
```

## 类型定义

### Session

```typescript
interface SessionInfo {
  id: string;
  path: string;
  cwd: string;
  name: string | undefined;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
}

interface SessionGroup {
  global: SessionInfo[];
  byProject: Record<string, SessionInfo[]>;
}
```

### Message

```typescript
interface Message {
  role: 'user' | 'assistant' | 'tool' | 'toolResult';
  content: ContentBlock[] | string;
  timestamp: number;
  // assistant 特有
  api?: string;
  provider?: string;
  model?: string;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: {...};
  };
  stopReason?: string;
  responseId?: string;
}

interface ContentBlock {
  type: 'text' | 'thinking' | 'toolCall' | 'tool_result' | 'code';
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: any;
  toolCallId?: string;
  toolName?: string;
  content?: any;
  isError?: boolean;
  code?: string;
  language?: string;
}
```

### Project

```typescript
interface Project {
  path: string;
  name: string;
  createdAt: number;
}
```

### Provider / Model

```typescript
interface Provider {
  id: string;
  name?: string;
  hasApiKey: boolean;
}

interface Model {
  id: string;
  provider: string;
}
```

### Context

```typescript
interface ContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}
```

### Thinking

```typescript
interface ThinkingLevel {
  level: string;
  supportsThinking: boolean;
  availableLevels: string[];
}
```

## IPC Channel 映射

| AgentService 方法 | IPC Channel |
|-------------------|-------------|
| `init()` | `agent:init` |
| `hasActiveSession()` | `agent:hasActiveSession` |
| `prompt(text)` | `agent:prompt` |
| `getMessages()` | `agent:getMessages` |
| `getSessionId()` | `agent:getSessionId` |
| `listSessions()` | `agent:listSessions` |
| `listSessionGroups()` | `agent:listSessionGroups` |
| `createSession(name?)` | `agent:newSession` |
| `createGlobalSession(name?)` | `agent:newGlobalSession` |
| `createSessionForProject(cwd, name?)` | `agent:newSessionForProject` |
| `switchSession(path, cwd)` | `agent:switchSession` |
| `deleteSession(path)` | `agent:deleteSession` |
| `renameSession(path, name)` | `agent:renameSession` |
| `listProjects()` | `agent:listProjects` |
| `activateProject(path)` | `agent:activateProject` |
| `deleteProject(path)` | `agent:deleteProject` |
| `renameProject(path, newName)` | `agent:renameProject` |
| `getCurrentCwd()` | `agent:getCurrentCwd` |
| `getConfig()` | `agent:getConfig` |
| `getProviders()` | `agent:getProviders` |
| `getModels(provider)` | `agent:getModels` |
| `setModel(model)` | `agent:setModel` |
| `saveApiKey(provider, key)` | `agent:saveApiKey` |
| `removeApiKey(provider)` | `agent:removeApiKey` |
| `isFirstRun()` | `agent:isFirstRun` |
| `reloadProviders()` | `agent:reloadProviders` |
| `getContextUsage()` | `agent:getContextUsage` |
| `compact(instructions?)` | `agent:compact` |
| `setAutoCompaction(enabled)` | `agent:setAutoCompaction` |
| `getAutoCompaction()` | `agent:getAutoCompaction` |
| `isCompacting()` | `agent:isCompacting` |
| `getSessionStats()` | `agent:getSessionStats` |
| `getThinkingLevel()` | `agent:getThinkingLevel` |
| `setThinkingLevel(level)` | `agent:setThinkingLevel` |
| `cycleThinkingLevel()` | `agent:cycleThinkingLevel` |
| `abort()` | `agent:abort` |
| `onEvent(callback)` | `agent:event` (ipcRenderer.on) |
| `getAgentHome()` | `agent:getAgentHome` |

## 返回值约定

### 成功响应

```typescript
{ success: true }
// 或带数据
{ success: true, sessionId: '...', sessionPath: '...' }
```

### 失败响应

```typescript
// 方式1: 通过 success 字段
{ success: false, error: '错误信息' }

// 方式2: 抛出异常
throw new Error('错误信息');
// IPC 层会自动转换为 rejected promise
```

## 事件类型

```typescript
type AgentSessionEvent =
  | { type: 'message'; message: Message }
  | { type: 'streaming'; done: boolean }
  | { type: 'compact' }
  | { type: 'compact-done'; summary?: string }
  | { type: 'context'; usage: ContextUsage }
  | { type: 'error'; error: string }
  | { type: 'compacting' };
```