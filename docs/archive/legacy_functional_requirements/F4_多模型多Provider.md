# Feature 需求：F4 - 多模型多 Provider (Multi-Model Routing)

## 1. 背景与目标
不同的 LLM 在不同场景下表现各异（如：深度逻辑用 Claude 3.5，快速修改用 GPT-4o-mini，本地脱网用 Ollama/DeepSeek）。目前系统硬编码为单一 Provider。

**目标**：解耦 LLM 调用层，支持动态切换及多模型协作。

## 2. 核心功能点

### 2.1 动态 Provider 注册
- **功能**：支持在 `.env` 或运行时动态添加新的 LLM 接口。
- **支持范围**：OpenAI, Anthropic, DeepSeek, Local Ollama。

### 2.2 模型热切换 (`/model` 指令)
- **功能**：在交互模式下通过命令行一键切换当前使用的模型。

### 2.3 降级逻辑 (Fallback)
- **功能**：当首选模型 API 超时或报错（如 GLM 拥堵）时，自动尝试备选模型执行任务。

## 3. 验收标准
- [ ] 能在对话过程中通过 `/model deepseek` 切换模型并顺畅继续对话。
- [ ] Token 统计仪表盘 (`Telemetry`) 能够区分不同模型的消耗与计费。

## 4. 技术方案
- 强化 `LLMEngine` 的工厂模式。
- 统一 `LLMResponse` 及其 Token 统计格式。
