# P0 Core Supplement
p0-core-supplement

本文档补充 P0 最精简 Agent 的缺口与提示词实践要点，并标记当前状态。

## P0 发布必改项

- 工具 schema 单一来源（zod -> JSON Schema 自动转换）【未完成】
- 工具安全边界（ReadFileTool 仅允许仓库内文件）【完成】
- 错误可诊断（工具/模型错误需要可读输出与上下文）【未完成】
- RunCommandTool（含白名单、工作目录限制、超时）【未完成】

## P0 强烈建议项

- 验收脚本：读文件并总结，验证闭环可用性【未完成】
- 可开关日志：记录 tool_call 与 tool_result 便于排错【未完成】

## 可选但有价值

- generateStream（流式输出）【未完成】
- 最基本上下文策略（比如保留最近 N 轮）【未完成】

## System Prompt

- 当前实现：`You are a helpful assistant. Use tools when needed and return final answer to the user.`【未完成】
- 建议版本（工具优先，工程可用）：【未完成】
  ```
  You are a tool-first assistant.
  Always use available tools to gather or verify facts when a tool can help.
  Do not guess or fabricate tool outputs; if a tool fails, say why and suggest next steps.
  When calling tools, strictly follow the tool schema and provide only valid arguments.
  Prefer concise, actionable responses after tool results are available.
  Never access files outside the repository workspace.
  ```

## 分层提示的文件存放建议

- `prompts/system.md`（全局规则）【未完成】
- `prompts/developer.md`（产品策略/工具规范）【未完成】
- `prompts/task_templates/*.md`（任务模板）【未完成】

## Prompt 测试与调优

- 固定用例集（`eval/cases.json`）与回归脚本【未完成】
- 固定模型与温度（如温度=0）以减少随机性【未完成】
- 验证工具调用是否出现（tool_call 断言）【未完成】
