# CodeAgent Feature Roadmap (Pi-Agent Era)

本文档记录了 CodeAgent 在迁移至 Pi-Agent 内核及 Ink TUI 后的新架构演进路线。

## 核心演进路线

| 优先级   | 功能 ID | 功能名称                              | 描述                                                                                      | 状态      | 相关文档                                                   |
| :------- | :------ | :------------------------------------ | :---------------------------------------------------------------------------------------- | :-------- | :--------------------------------------------------------- |
| **High** | N1 | **新内核与 Ink 集成** | 迁移至 Pi-Agent 内核，并使用 Ink 构建全功能 TUI。 | ✅ 已完成 | [详情](../archive/新架构功能需求/completed/N1_新内核与Ink集成.md) |
| **High** | N2 | **多 Provider 支持与 Env 配置** | 支持通过环境变量动态配置 Provider baseUrl，替代硬编码。 | ✅ 已完成 | [详情](../archive/新架构功能需求/completed/N2_多Provider支持与Env配置.md) |
| **High** | N3 | **会话生命周期与持久化基线** | 统一 session 生命周期、异步化与原子写入，明确 `/new`、`/history`、`/resume` 语义。 | ✅ 已完成 | [详情](../archive/新架构功能需求/completed/N3_会话生命周期与持久化基线.md) |
| **High** | N4 | **会话存储抽象与兼容迁移** | 引入 `SessionRepository` 抽象、schema version 与 migration，支持 JSON/SQLite 双实现路径。 | ✅ 已完成 | [详情](../archive/新架构功能需求/completed/N4_会话存储抽象与兼容迁移.md) |
| **Med** | N11 | **Ink TUI 输入系统重构** | 简化输入处理架构，修复 Windows Enter 键问题，集成 Debug Panel。 | ✅ 已完成 | [详情](../archive/新架构功能需求/completed/N11_Ink_TUI_输入系统重构.md) |
| **Med** | N12 | **自动化测试方案** | 建立 Vitest 单元测试体系，覆盖 slash 命令、消息处理等核心逻辑。 | ✅ 已完成 | [详情](../archive/新架构功能需求/completed/N12_自动化测试方案.md) |

---

## 2026 Q1 里程碑达成看板

> 此处记录已合入主分支的功能特性。

### [已达成] N1：新架构基座

- **达成时间**：2026-03-22
- **核心能力**：
  - 基于 `@mariozechner/pi-agent-core` 的新内核。
  - 基于 `Ink` 的响应式 TUI（Welcome Page / Chat Page）。
  - 支持 `/models`、`/history`、`/resume` 等交互式命令。
  - 核心文件操作工具与 Shell 命令执行集成。

### [已达成] N2：多 Provider 支持与 Env 配置

- **达成时间**：2026-03-25
- **核心能力**：
  - 通过环境变量 `{PROVIDER}_BASE_URL` 动态配置 API 端点。
  - Provider Override 机制，支持 baseUrl 与 api 类型覆盖。
  - 修复 dotenv 加载时机问题，确保 env 变量正确读取。
  - 支持 Minimax (openai-completions)、Zhipu (zai) 等 Provider 配置。

### [已达成] N3：会话生命周期与持久化基线

- **达成时间**：2026-04-14
- **核心能力**：
  - 统一 session 生命周期状态（active/completed/interrupted/error）。
  - 异步 + 原子写入（tmp -> rename），启动时清理残留 .tmp 文件。
  - `/new`、`/history`、`/resume` 语义明确，首条消息才创建 session。
  - 元数据包含 id/title/updatedAt/messageCount/model/provider/status/version。

### [已达成] N4：会话存储抽象与兼容迁移

- **达成时间**：2026-04-14
- **核心能力**：
  - `ISessionRepository` 接口抽象，包含 save/load/list/delete/latestId。
  - `JsonSessionRepository` 默认实现，完整迁移链（v0 -> v1）。
  - Schema version 与 migration 机制，向后兼容读取。
  - 乐观并发控制，冲突返回明确错误。

### [已达成] N11：Ink TUI 输入系统重构

- **达成时间**：2026-04-06
- **核心能力**：
  - `App.tsx` + `AppController.ts` 职责分离，替代巨型 `pi_app.tsx`。
  - Zustand 多 store 替代单一 useReducer，精准更新。
  - `InputController.ts` 独立输入处理，Windows Terminal Enter 键兼容。
  - `debugStore` 任意位置调用，无需 prop 层层传递。

### [已达成] N12：自动化测试方案

- **达成时间**：2026-04-14
- **核心能力**：
  - Vitest 测试框架，59 个测试文件（单元/组件/集成）。
  - 覆盖 slash 命令、消息处理、会话管理、工具安全等核心逻辑。
  - `tests/unit/agent/sessionRepository.test.ts` 覆盖存储抽象。
  - CI 集成 `npm run test:run` 与覆盖率报告。

---

## 下一步行动建议
核心架构已全面完成（N1/N2/N3/N4/N11/N12）。所有功能需求均已完成或废弃。

下一步建议：

1. **新功能探索**：通过 `codeagent-ideas` cron job 持续生成新的功能提案。
2. **技术债务清理**：定期审查和优化代码质量。
3. **废弃说明**：N5/N6/N7/N8/N9/N10 已废弃，相关需求被后续工作吸收或不再适用。
