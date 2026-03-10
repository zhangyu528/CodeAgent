# CodeAgent 技术栈文档

本文档描述了 CodeAgent (Windows 版 Coding Agent) 的推荐技术栈和架构选型。

## 1. 核心框架 (Core Framework)
**技术选型**: .NET 8 (LTS) - C#

**选择理由**:
*   **原生 Windows 集成**: 作为 Windows 平台的应用，.NET 提供最完善的 API 支持和系统集成能力。
*   **高性能**: .NET 8 在性能上有显著提升，适合处理复杂的 Agent 逻辑。
*   **发布便捷**: 支持 Native AOT 和单文件发布，方便用户分发和使用 (无需安装巨大运行时)。
*   **类型安全**: C# 的强类型系统有助于构建健壮的 Agent 架构，减少运行时错误。
*   **生态一致性**: 与现有的 `aiden-windows` 项目保持技术栈一致，便于代码复用和维护。

## 2. LLM 编排与 Agent 框架 (LLM Orchestration)
**技术选型**: Microsoft Semantic Kernel (SK)

**模块映射**:
*   **LLM Engine**: SK 的 `IChatCompletionService` 提供统一的模型调用接口 (OpenAI, Azure OpenAI, HuggingFace, Local LLMs 等)。
*   **Tool System**: SK 的 `Plugins` (插件) 机制完美对应设计文档中的 Tool System，支持将 C# 方法 (Native Functions) 暴露给 AI 使用。
*   **Planner**: SK 内置的 `HandlebarsPlanner` 或 `FunctionCallingStepwisePlanner` 可直接用于实现 Agent 的任务拆解 (Planner) 能力。
*   **Memory**: SK 的 `ISemanticTextMemory` 抽象和丰富的向量数据库连接器 (如 Qdrant, SQLite 等) 支持长短期记忆的实现。

## 3. 命令行接口 (CLI Framework)
**技术选型**: System.CommandLine

**模块映射**:
*   **CLI Interface**: 微软官方推荐的命令行库，提供现代化的命令行参数解析、强类型绑定、自动生成帮助文档和 Tab 自动补全功能。

## 4. 依赖注入与可观测性 (DI & Observability)
**技术选型**: Microsoft.Extensions.Hosting / OpenTelemetry

**模块映射**:
*   **Observability (可观测性)**: 使用 .NET 标准的 `ILogger` 抽象。结合 OpenTelemetry，可以标准化地记录 Metrics (Token 消耗, 耗时) 和 Traces (Agent 思考链路)，便于对接 Prometheus/Grafana 或本地日志分析工具。
*   **Architecture**: 使用通用主机模式 (Generic Host) 管理应用程序生命周期、配置加载 (appsettings.json) 和依赖注入 (DI)，保持架构整洁。

## 5. 执行环境 (Execution Environment)
**技术选型**: System.Diagnostics.Process / PowerShell SDK

**模块映射**:
*   **Execution Environment**:
    *   **命令执行**: 基础命令使用 `System.Diagnostics.Process` 启动外部进程。
    *   **高级脚本**: 集成 `Microsoft.PowerShell.SDK`，允许 Agent 在进程内直接执行复杂的 PowerShell 脚本，并结构化地获取输出对象，而不仅仅是文本流。

## 总结
该技术栈充分利用了微软在 AI (Semantic Kernel) 和系统编程 (.NET 8) 领域的最新成果，非常适合构建 Windows 平台的高性能本地 Coding Agent。
