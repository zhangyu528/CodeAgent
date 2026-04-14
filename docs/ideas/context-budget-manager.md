# Context Budget Manager

## Problem Statement

CodeAgent operates across multiple LLM providers (OpenAI、Anthropic、Zhipu、Minimax），每个 provider 的模型上下文窗口差异巨大——从 4K 到 200K token 不等。当前系统对上下文的消耗完全黑盒：用户不知道系统提示词占用多少、会话历史消耗多少、工具 schema 膨胀到多大。一旦接近模型上下文上限，响应被截断甚至失败，用户得不到预警，也没有任何控制手段。

## Recommended Direction

引入 **Context Budget Manager（CBM）**——一个在每次 API 调用前预估、在 UI 中实时展示、在接近上限前主动警告的上下文消耗管理系统。CBM 不是简单的 token 计数，而是将上下文预算分解为多个可配置的"账户"：

- **System Account**：系统提示词（固定开销，极端情况可压缩）
- **History Account**：会话历史滑动窗口（可配置大小）
- **Schema Account**：工具 schema 描述（可按工具集选择性加载）
- **Context Account**：项目上下文（如 codebase index）等动态注入内容

每个账户独立设置软上限和硬上限，当任一账户消耗到 80% 时触发警告，到 95% 时触发自动压缩或拒绝新消息。

## Key Assumptions to Validate

- [ ] **假设 1**：多 provider 环境下用户确实面临上下文管理困惑
  → *验证方法*：用户访谈或 session 分析，查看是否有"上下文超限"相关错误
- [ ] **假设 2**：用户愿意配置各账户的预算比例（而非全交给系统自动决定）
  → *验证方法*：A/B 测试，看默认自动模式 vs 可配置模式的用户满意度
- [ ] **假设 3**：Schema 压缩（如 lazy loading 工具集）不会显著影响工具调用准确率
  → *验证方法*：在已有工具集上做召回率测试，对比全量加载 vs 按需加载

## MVP Scope

**做：**
- `src/agent/contextBudget.ts`：预算计算核心，暴露 `getBudgetReport()` 接口
- 预算分解估算：系统提示词 token 数（精确计算）、历史窗口 token 数（基于消息长度估算）、工具 schema token 数（静态 + 动态）
- `budgetStore`：Zustand store，存储预算状态，供 UI 消费
- Chat Page 底部状态栏：实时显示 `"预算: H=45% / S=12% / C=8%"`（H=History，S=Schema，C=Context）
- 80% 软警告：状态栏变黄，输出内联提示 `"⚠️ 历史上下文已消耗 80%"`；95% 硬截断：拒绝发送新消息，弹出说明
- Provider 级配置：`{PROVIDER}_MAX_CONTEXT` 环境变量，自动读取模型 context window

**不做：**
- 自动历史压缩（留待 token-aware-message-windowing 提案）
- 动态 schema 裁剪（需要 schema 结构化解析，v1 只做整块统计）
- 跨 session 的持久化预算报告
- 干扰 agent 自身决策的实时注入式提醒（仅 UI 警告，不改 system prompt）

## Not Doing (and Why)

- **Agent 可见的上下文提示**（如在 system prompt 中注入"你只剩 X token"）—— 这会污染 prompt，降低 agent 决策质量；UI 层警告已足够
- **自动压缩历史**—— 属于 token-aware-message-windowing 提案的范围，CBM 专注测量和展示
- **多 session 并发预算**—— 当前架构单 session 运行，无需跨 session 协调
- **嵌入向量预算**—— v1 基于 token 统计，不做语义嵌入计算

## Open Questions

- 工具 schema 的 token 估算精度：静态描述文本 vs 运行时注入的参数——如何统一计量？
- 某些 provider（如 Zhipu）的 context window 信息不全——如何处理未知上限？
- 预算警告的频率：每次 API 调用都报告太吵，只在显著变化时提醒——阈值多少合适？
- 是否应该暴露 `/{budget,context}` slash 命令让用户手动查看详情？
