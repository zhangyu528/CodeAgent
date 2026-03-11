**F4 多模型多 Provider：开发计划**

**Summary**
引入多 Provider 架构（OpenAI/Anthropic/DeepSeek/Ollama），支持 REPL 中 `/model <provider>` 热切换；LLM 调用统一返回标准 token 使用；Telemetry 按 Provider 统计。自动降级本期不做。

**Key Changes**
1. **Provider 扩展**
   - 新增 `openai_provider.ts`, `anthropic_provider.ts`, `deepseek_provider.ts`, `ollama_provider.ts`，统一实现 `LLMProvider` 接口。
   - 每个 Provider 从 `.env` 读取 API Key 与 base URL；默认模型必须在 `.env` 指定（无内置默认）。
   - 统一 `LLMResponse.usage` 结构，适配各家响应字段。

2. **LLMEngine 工厂化注册**
   - 增加 `registerProvidersFromEnv()` 或等价工厂模块，基于 `.env` 检测并注册可用 Provider。
   - Provider 名称固定为：`openai`, `anthropic`, `deepseek`, `ollama`。

3. **运行时模型切换**
   - REPL 解析 `/model <provider>`：
     - 校验 provider 是否已注册；若未注册返回提示。
     - 切换默认 provider，并在后续 `AgentController`/`Planner` 调用中生效。
   - `AgentController`/`Planner` 增加 `setProvider(name: string)` 或通过共享状态获取当前 provider。

4. **Telemetry 按 Provider 统计**
   - `TelemetryMonitor` 扩展为按 provider 维护输入/输出 token 累计与成本。
   - `logger.tokenUsage` 增加当前 provider 与分项统计展示（例如：`Current Provider: openai | Total: ... | openai: ...`）。

5. **Fallback**
   - 本期不实现自动降级逻辑；保留 `LLMEngine.generate()` 的同步错误抛出行为。

**Public API / Interface Changes**
- `.env` 新增：
  - `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
  - `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`
  - `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`
  - `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- `LLMEngine` 新增 provider 注册工厂或辅助注册方法。
- `AgentController`/`Planner` 新增 provider 切换接口或依赖注入方式更新。

**Test Plan**
1. Unit: Provider 响应解析 → `LLMResponse.usage` 结构正确。
2. Integration: `/model <provider>` 切换后，`AgentController` 使用新 provider 发起请求。
3. Unit/Integration: `TelemetryMonitor` 按 provider 累计 token 与成本。

**Assumptions**
- 默认模型必须在 `.env` 指定；未配置则该 provider 不注册或报错并跳过。
- 只支持 `/model <provider>`（无模型名参数）。
- 自动降级不做，后续迭代再加。
