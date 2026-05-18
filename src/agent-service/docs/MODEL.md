# Model 管理

## 概述

Agent Service 支持多 Provider + 多 Model 配置，通过 `model/registry.ts` 和 `auth/storage.ts` 管理。

## Provider 管理

Provider 是 LLM 服务商，如 `minimax-cn`, `openai`, `anthropic` 等。

### 获取 Provider 列表

```typescript
// service.ts
async getProviders() {
  await ensureProvidersLoaded();
  return getProviders().map(p => ({ id: p, hasApiKey: checkApiKeyConfigured(p) }));
}
```

### Provider 接口

```typescript
interface Provider {
  id: string;           // 如 'minimax-cn'
  name?: string;        // 显示名称
  hasApiKey: boolean;  // 是否已配置 API Key
}
```

## Model 管理

### 获取模型列表

```typescript
async getModels(provider: string) {
  const models = getModels(provider);
  return models.map(m => ({ id: m.id, provider: m.provider }));
}
```

### Model 接口

```typescript
interface Model {
  id: string;      // 如 'MiniMax-M2.7'
  provider: string; // 如 'minimax-cn'
}
```

## API Key 管理

### 保存 API Key

```typescript
async saveApiKey(provider: string, apiKey: string) {
  return { success: saveApiKey(provider, apiKey) };
}
```

### 移除 API Key

```typescript
async removeApiKey(provider: string) {
  removeApiKey(provider);
  return { success: true };
}
```

### 检查是否已配置

```typescript
checkApiKeyConfigured(provider: string): boolean;
```

## 当前配置

```typescript
async getConfig() {
  return {
    providers: [...],
    currentModel: settings.model ?? null
  };
}
```

## 设置模型

```typescript
async setModel(model: { id: string; provider?: string }) {
  await setModel(model);
}
```

## Thinking Level

```typescript
async getThinkingLevel() {
  return {
    level: session.thinkingLevel ?? 'medium',
    supportsThinking: false,
    availableLevels: []
  };
}

setThinkingLevel(level: string) {
  session.setThinkingLevel(level);
}
```

可用级别：`off`, `low`, `medium`, `high`

## Provider 配置示例

```typescript
// providers.json 结构
{
  "providers": {
    "minimax-cn": {
      "apiKey": "...",
      "models": ["MiniMax-M2.7", "MiniMax-Text-01"]
    }
  }
}
```

## IPC 接口

| 方法 | 参数 | 返回值 |
|------|------|--------|
| `getConfig()` | - | `{ providers, currentModel }` |
| `getProviders()` | - | `Provider[]` |
| `getModels(provider)` | `provider: string` | `Model[]` |
| `setModel(model)` | `{ id, provider? }` | `void` |
| `saveApiKey(provider, key)` | `provider, key` | `{ success }` |
| `removeApiKey(provider)` | `provider` | `{ success }` |
| `isFirstRun()` | - | `boolean` |
| `reloadProviders()` | - | `{ success, providers }` |