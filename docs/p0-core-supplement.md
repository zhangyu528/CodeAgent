# P0 Core Supplement
p0-core-supplement

本文档补充 P0 最精简 Agent 的缺口与提示词实践要点，并标记当前状态。

## P0 发布必改项

- 工具 schema 单一来源（zod -> JSON Schema 自动转换）【完成】
- 工具安全边界（ReadFileTool 仅允许仓库内文件）【完成】
- 错误可诊断（工具/模型错误需要可读输出与上下文）【完成】
- 错误分层（LLM / Tool / Agent 编排阶段区分）【完成】
- RunCommandTool（含白名单、工作目录限制、超时）【完成】

## P0 强烈建议项

- 验收脚本：读文件并总结，验证闭环可用性【完成】
- 可开关日志：记录 tool_call 与 tool_result 便于排错【未完成】
- 任务拆解策略：由 LLM 生成计划、由 Agent 决定是否/何时要求计划【未完成】

## 可选但有价值

- generateStream（流式输出）【未完成】
- 最基本上下文策略（比如保留最近 N 轮）【完成】

## System Prompt

- ~~当前实现：`You are a helpful assistant. Use tools when needed and return final answer to the user.`~~【完成】
- 建议版本（工具优先，工程可用）：【完成】
  ```
  You are a tool-first assistant.
  Always use available tools to gather or verify facts when a tool can help.
  Do not guess or fabricate tool outputs; if a tool fails, say why and suggest next steps.
  When calling tools, strictly follow the tool schema and provide only valid arguments.
  Prefer concise, actionable responses after tool results are available.
  Never access files outside the repository workspace.
  ```

## 分层提示的文件存放建议

- `prompts/system.md`（全局规则）【完成】
- `prompts/developer.md`（产品策略/工具规范）【完成】
- `prompts/task_templates/*.md`（任务模板）【完成】
- developer prompt 内容规范（任务风格、错误处理、工具优先等）【完成】
  - 原因：统一 developer 层规则可减少行为漂移，稳定工具优先与错误处理策略。

## Prompt 测试与调优

- 固定用例集（`eval/cases.json`）与回归脚本【未完成】
- 固定模型与温度（如温度=0）以减少随机性【未完成】
- 验证工具调用是否出现（tool_call 断言）【未完成】

## P2 进展（里程碑标记）

- Memory 最小可用：短期记忆 + JSON 持久化【完成】
- Security Layer：路径校验 + 命令校验 + CLI HITL【完成】

## P3 进展（里程碑标记）

- 向量存储与检索（VectorStore + 搜索脚本）【完成】
- Embedding Provider 切换（hash/glm）【完成】
- 服务化接口（/health, /run）【完成】
