# Agent Optimization Notes

面向后续 Agent 优化的常见错误类型与调优方向。

## 常见错误类型

- LLM 请求层
  - 鉴权失败（API Key/权限）
  - 连接失败/超时/限流
  - 模型名错误或不可用
- 工具调用层
  - 工具不存在（tool name 不匹配）
  - JSON 参数不合法（模型输出格式不对）
  - 参数校验失败（zod 校验失败）
  - 工具执行报错（文件不存在/权限不足/超时）
- 协议与上下文
  - 模型没有产生 tool_call（明明需要工具）
  - 反复调用工具不收敛（循环）
  - 输出内容与工具结果不一致（幻觉）
- 资源限制
  - 上下文过长导致截断
  - 输出过短导致信息不完整
- 工程错误
  - Prompt 规则冲突
  - 读取不到 prompt 文件
  - 依赖未安装

## 调优时常调的 LLM 参数

- `model`
- `temperature`
- `max_tokens`
- `tool_choice`
- `top_p` / `frequency_penalty` / `presence_penalty`（视 Provider 支持情况）

## 需要在 Agent 侧优化或暴露的配置

- 默认值策略（如工具优先时使用低温度）
- 可配置入口（env/config）
- 调试开关（输出 tool_call / tool_result / LLM 响应片段）
- 容错策略（JSON 解析失败是否重试/纠错）

## 对成功率影响较大的因素

- System/Developer Prompt 强度与规则清晰度
- 上下文窗口管理（保留/裁剪策略）
- 工具 schema 的清晰度与约束准确性
- 错误处理与重试策略
- 工具返回格式的结构化程度
- 最大轮次/最大工具调用次数
- 输出长度限制（`max_tokens`）
- 温度设置（工具型任务建议低温度）

## 概念补充

- reasoning effort：部分模型提供的推理强度开关，用于平衡质量与成本/延迟。
- max tool calls：限制工具调用次数，避免无限循环或成本失控。
- context compression：上下文过长时将历史压缩为摘要以保留关键信息。
