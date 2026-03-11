# 开发优先级状态清单

该清单基于当前代码仓库实际实现情况，记录 P0–P3 的已完成与未完成项。

## P0 核心基础模块

**已完成**
- LLM Engine（Provider 接入）
- Tool System（zod 校验 + schema 自动化）
- Agent Controller（LLM → Tool → Result）
- 基础工具（Echo / ReadFile / RunCommand）
- 可读错误输出

**未完成**
- 流式输出（generateStream）【后做】
- 固定测试集与回归【优先】

## P1 执行能力模块

**已完成（最小版）**
- Execution Environment（spawn + stdout/stderr + timeout）
- Planner（JSON 计划）
- P1 验收入口

**未完成**
- `exec`/脚本执行分离接口【后做】
- 输出截断与超长处理【优先】
- Planner 步骤状态（pending/running/completed）【优先】
- DAG 并行/依赖执行【后做】

## P2 稳定性模块

**已完成（最小版）**
- Memory（短期 + JSON 持久化）
- Security Layer（路径/命令校验 + HITL）
- 摘要占位（summarize 回调）

**未完成**
- Token 精算【后做】
- 长期记忆向量库正式接入【后做】
- 状态恢复与中断续跑【优先】
- 命令审计日志与白名单细化【优先】

## P3 可用性模块

**已完成（最小版）**
- 服务化接口（/health, /run）
- 基础请求日志 + 文件落盘
- 向量检索/Provider 切换基础

**未完成**
- 分级日志（debug/info/warn/error）【优先】
- CLI 交互层（commander + inquirer）【后做】
- 终端可视化（ora/chalk）【后做】
- Token 成本统计【后做】
- CLI 配置管理（模型/参数）【后做】
