# 功能需求 N2：多 Provider 支持与 Env 配置

## 背景与问题
CodeAgent 已切换到 `pi-ai` / `pi-agent-core` 内核，但 provider 选择和 endpoint 配置如果依赖硬编码，会带来以下问题：
- 国内 provider 或代理场景需要自定义 `baseUrl`，硬编码方式扩展性差。
- provider、model、api 类型分散在代码和环境变量之间，配置来源不清晰。
- `.env` 加载时机不稳定时，模块顶层读取 `process.env` 容易得到空值。
- CLI 运行时选择 provider/model 后，如果不能落回 `.env`，下次启动无法复用配置。

## 目标
- 支持通过环境变量为不同 provider 配置 `API_KEY`、`MODEL`、`API`、`BASE_URL`。
- 明确 provider 配置优先级，避免代码中的硬编码 endpoint。
- 允许 CLI 内部选择的 provider/model 持久化写回 `.env`。
- 保持 UI 层不直接感知 provider 注册细节，由 factory 统一构建最终模型配置。

## 非目标
- 本阶段不实现 provider 健康检查和连通性探测。
- 本阶段不支持在 CLI 中直接编辑 `BASE_URL` / `API`。
- 本阶段不引入远程配置中心或多环境配置管理。

## 设计要点
### 配置来源与命名规范
统一环境变量命名：
- `DEFAULT_PROVIDER`
- `{PROVIDER}_API_KEY`
- `{PROVIDER}_MODEL`
- `{PROVIDER}_API`
- `{PROVIDER}_BASE_URL`

其中 `{PROVIDER}` 采用 provider id 大写并将 `-` 转为 `_`，例如：
- `zai` -> `ZAI_*`
- `minimax-cn` -> `MINIMAX_CN_*`

### Factory 构建规则
`createPiAgent()` 负责：
- 注册内置 provider
- 从 `DEFAULT_PROVIDER` 与 `{PROVIDER}_MODEL` 读取默认模型
- 若指定模型不存在，则回退到该 provider 的首个可用模型
- 基于环境变量合成最终 `api/baseUrl/model` 配置
- 若没有有效配置，则不设置默认模型，交由 CLI 进入 `/model` 选择流程

### Provider Override 策略
- 代码中允许保留最小 `PROVIDER_OVERRIDES` 作为 provider 兼容层。
- override 仅用于补充 `pi-ai` 注册表与目标 provider 的协议差异。
- `baseUrl` 和可变 `api` 不在模块顶层直接读取 `process.env`，统一在工厂函数执行期读取。

### 持久化写回
CLI 交互中配置 provider/model 或 API key 后：
- `saveModelConfig(provider, modelId)` 写回 `.env`
- `saveApiKey(provider, apiKey)` 写回 `.env`
- 同时同步更新当前进程的 `process.env`，保证本次会话立即生效

## 用户可见行为
- 若 `.env` 中存在有效 provider/model 配置，启动后直接进入可用状态。
- 若不存在有效模型配置，首次发送消息时会引导用户进入 `/model` 选择流程。
- 用户在 `/model` 中选择 provider、输入 API key、选择模型后，配置立即生效并持久化。
- 相同二进制无需改代码，只通过 `.env` 即可切换不同 provider endpoint。

## 验收标准
- Given `.env` 中配置 `DEFAULT_PROVIDER` 和 `{PROVIDER}_MODEL`，When 启动 CLI，Then agent 应加载对应 provider/model。
- Given `.env` 中配置 `{PROVIDER}_BASE_URL`，When 创建 agent，Then 最终模型配置应使用该自定义 endpoint。
- Given 模块加载时 dotenv 尚未初始化，When 创建 agent，Then 仍应在函数执行期正确读取环境变量。
- Given 用户在 `/model` 中完成 provider/model 选择，When 重启 CLI，Then 上一次选择应仍然生效。
- Given 指定模型不存在，When 创建 agent，Then 应回退到 provider 的首个可用模型或进入未配置状态，而不是直接崩溃。

## 风险与回滚
- 风险：provider id 与环境变量命名不一致，导致配置失效。
- 缓解：统一 provider id 规范，并在 factory 中集中转换命名。
- 风险：写回 `.env` 时覆盖用户已有配置。
- 缓解：仅更新目标 key，保留其他现有行。
- 回滚：保留 provider override 最小实现，必要时可回退为固定 provider 配置。

## 里程碑
- M1：`DEFAULT_PROVIDER` + `*_MODEL` + `*_API_KEY` 加载链路稳定。
- M2：`*_BASE_URL` / `*_API` 覆盖能力落地，移除硬编码 endpoint 依赖。
- M3：CLI `/model` 选择结果写回 `.env` 并在当前进程即时生效。
