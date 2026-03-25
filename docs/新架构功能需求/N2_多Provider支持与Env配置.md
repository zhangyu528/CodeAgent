# 功能需求 N2：多 Provider 支持与 Env 配置

## 概述

CodeAgent 通过 `pi-ai` 库支持多 Provider，但在实际使用中需要支持自定义 endpoint（特别是国内 Provider 如 Minimax、智谱等）。本功能实现了基于环境变量的 Provider 动态配置机制，替代原有的硬编码 baseUrl。

## 核心特性

### 1. Provider Override 机制

在 `src/core/pi/factory.ts` 中通过 `PROVIDER_OVERRIDES` 对象为特定 Provider 提供配置覆盖：

```typescript
const PROVIDER_OVERRIDES: Record<string, { baseUrl?: string; api?: string }> = {
  minimax: { api: 'openai-completions' },
};
```

**关键设计**：仅设置 `api` 字段，`baseUrl` 在函数执行时通过环境变量动态读取，避免 dotenv 未加载时读取到 `undefined`。

### 2. 动态 BaseURL 读取

通过统一的命名规范 `{PROVIDER}_BASE_URL` 从环境变量读取 baseUrl：

```typescript
const baseUrlFromEnv = `${provider.toUpperCase().replace(/-/g, '_')}_BASE_URL`;
const envBaseUrl = process.env[baseUrlFromEnv];
```

例如：
- `MINIMAX_BASE_URL` → minimax provider
- `ZAI_BASE_URL` → zai (智谱) provider

### 3. Provider 与 Model 映射

`pi-ai` 库中的 Provider 名称与传统的 Provider 名称不完全一致。当前支持的 Provider：

| Provider ID | 说明 | 示例模型 |
|---|---|---|
| `minimax` | MiniMax | MiniMax-M2.7 |
| `zai` | 智谱 GLM | glm-4.7, glm-5 |
| `anthropic` | Anthropic Claude | claude-3-5-sonnet |
| `openai` | OpenAI GPT | gpt-4o |
| `google` | Google Gemini | gemini-2.5-flash |

**注意**：`glm` 不是有效的 Provider ID，智谱对应的 ID 是 `zai`。

### 4. 环境变量配置

#### `.env.example` 配置示例

```env
# 默认 Provider（zai 或 minimax）
DEFAULT_PROVIDER=zai

# --- Zhipu GLM (provider: zai) ---
ZAI_API_KEY=your_zhipu_api_key_here
ZAI_MODEL=glm-4.7

# --- Minimax (provider: minimax) ---
MINIMAX_API_KEY=your_minimax_api_key_here
MINIMAX_MODEL=MiniMax-M2.7
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
```

#### 关键配置说明

| 变量名 | 说明 | 默认值 |
|---|---|---|
| `DEFAULT_PROVIDER` | 默认使用的 Provider ID | `minimax` |
| `{PROVIDER}_API_KEY` | 各 Provider 的 API Key | 无 |
| `{PROVIDER}_MODEL` | 覆盖默认模型 | Provider 注册表中的默认模型 |
| `{PROVIDER}_API` | 覆盖 API 类型（可选） | 使用 pi-ai 注册表中的类型 |
| `{PROVIDER}_BASE_URL` | 覆盖 baseUrl（可选） | 使用 pi-ai 注册表中的 URL |

#### API 类型说明

pi-ai 支持的 API 类型：

| API 类型 | 说明 | 请求格式 |
|---|---|---|
| `openai-completions` | OpenAI Chat Completions 兼容 | POST `/v1/chat/completions` |
| `anthropic` | Anthropic 官方格式 | POST `/v1/messages` |
| `openai-responses` | OpenAI Responses API | POST `/v1/responses` |

## 实现细节

### Factory 模式

`createPiAgent()` 函数负责初始化 Agent 并应用配置：

1. 调用 `registerBuiltInApiProviders()` 注册所有内置 Provider
2. 从 `DEFAULT_PROVIDER` 和 `{PROVIDER}_MODEL` 读取配置
3. 通过 `getModel()` 获取 Provider 注册表中的模型
4. 应用 `PROVIDER_OVERRIDES` 中的 api 覆盖
5. 从环境变量读取 `*_BASE_URL` 并覆盖 baseUrl

### 避免常见陷阱

**问题**：在模块顶层使用 `process.env.XXX` 可能导致 dotenv 未加载时读取到 `undefined`。

**解决**：
- 在 `PROVIDER_OVERRIDES` 对象字面量中不直接读取 `process.env`
- 仅声明需要的字段，在函数执行时动态读取环境变量

```typescript
// ❌ 错误：模块加载时 dotenv 可能未执行
const PROVIDER_OVERRIDES = {
  minimax: { baseUrl: process.env.MINIMAX_BASE_URL },
};

// ✅ 正确：延迟到函数执行时读取
const PROVIDER_OVERRIDES = {
  minimax: { api: 'openai-completions' },
};

// baseUrl 和 api 在 createPiAgent() 函数内通过 process.env 读取
const providerUpper = provider.toUpperCase().replace(/-/g, '_');
const baseUrlFromEnv = `${providerUpper}_BASE_URL`;
const apiFromEnv = `${providerUpper}_API`;
const envBaseUrl = process.env[baseUrlFromEnv];
const envApi = process.env[apiFromEnv];
```

## 已验证的 Provider 配置

### Minimax

```env
DEFAULT_PROVIDER=minimax
MINIMAX_API_KEY=your_key
MINIMAX_MODEL=MiniMax-M2.7
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
```

- **API 类型**：`openai-completions`（OpenAI Chat Completions 兼容）
- **Endpoint**：`https://api.minimaxi.com/v1/chat/completions`

### 智谱 (Zhipu)

```env
DEFAULT_PROVIDER=zai
ZAI_API_KEY=your_key
ZAI_MODEL=glm-4.7
```

- **API 类型**：使用 zai provider 默认配置
- **可用模型**：`glm-4.5`, `glm-4.6`, `glm-4.7`, `glm-5`, `glm-5-turbo`

## 下一步计划

- [ ] 添加更多 Provider 的 baseUrl 配置支持
- [ ] 支持通过 CLI 命令动态修改 `*_BASE_URL`
- [ ] 提供 Provider 连接性健康检查
