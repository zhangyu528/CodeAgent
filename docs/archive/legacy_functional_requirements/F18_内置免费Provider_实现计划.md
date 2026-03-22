# F18 内置免费 Provider - 实现计划

## 1. 目标 (Objective)

让新用户首次使用CLI时，无需配置任何API Key即可直接体验产品。通过内置免费GLM Provider作为默认fallback，降低用户上手门槛，提升首次使用体验。

## 2. 背景 (Background)

- 当前用户首次使用CLI时，如果没有配置任何Provider，会强制运行初始化向导要求输入API Key
- 这增加了用户的上手成本，部分用户可能因此流失
- 目标：让用户"开箱即用"，体验后再决定是否配置自己的Provider

## 3. 方案设计 (Solution Design)

### 3.1 技术方案

复用现有的`GLMProvider`实现，通过环境变量注入内置API Key。

#### 环境变量

| 变量名 | 用途 | 默认值 |
|--------|------|--------|
| `BUILT_IN_GLM_API_KEY` | 内置免费GLM API Key | - |
| `BUILT_IN_GLM_MODEL` | 内置免费GLM模型 | glm-4-flash |

#### 用户配置优先级

```
用户配置了 GLM_API_KEY → 使用用户自己的key
用户没有配置任何provider → 使用内置免费GLM key
```

### 3.2 改动文件

| 文件 | 改动内容 |
|------|----------|
| `src/core/llm/register_providers.ts` | 添加内置GLM key的自动注册逻辑 |
| `src/apps/cli/components/factory.ts` | 简化初始化逻辑 |
| `.env` | 添加内置key配置（BUILT_IN_GLM_API_KEY） |
| `.env.example` | 添加内置Provider配置说明 |

### 3.3 实现逻辑

```typescript
// register_providers.ts

const BUILT_IN_GLM_API_KEY = process.env.BUILT_IN_GLM_API_KEY;
const BUILT_IN_GLM_MODEL = process.env.BUILT_IN_GLM_MODEL || 'glm-4-flash';

export function registerProvidersFromEnv(engine: LLMEngine): ProviderRegistrationResult {
  // 1. 先注册用户配置的provider
  // ... 现有逻辑 ...

  // 2. 如果没有任何provider，使用内置免费GLM
  if (registered.length === 0 && BUILT_IN_GLM_API_KEY) {
    const provider = new GLMProvider(BUILT_IN_GLM_API_KEY);
    if (BUILT_IN_GLM_MODEL) {
      provider.setModel(BUILT_IN_GLM_MODEL);
    }
    engine.registerProvider(provider);
    registered.push('glm (内置免费)');
  }

  return { registered, skipped };
}
```

### 3.4 用户体验流程

```
用户首次启动CLI
    ↓
检测环境变量中的provider配置
    ↓
无用户配置
    ↓
自动注册内置GLM Provider
    ↓
显示欢迎界面：当前使用 GLM(内置免费)
    ↓
用户正常使用CLI
    ↓
用户可随时配置自己的 GLM_API_KEY 覆盖内置配置
```

## 4. 风险与限制

### 4.1 风险

- **API Key泄露风险**：内置key有泄露风险
- **成本控制**：免费额度可能被滥用

### 4.2 应对措施

- **后续方案**：接入API代理网关，统一管理key和调用量
- **频率限制**：可在provider层添加调用频率限制（如每分钟15次）

## 5. 未来规划

- 接入API代理网关，统一管理内置key
- 添加调用频率限制
- 支持更多免费Provider（如Groq）

## 6. 状态

- [x] register_providers.ts 修改
- [x] factory.ts 修改
- [ ] .env 配置
- [ ] .env.example 更新
- [ ] 测试验证
