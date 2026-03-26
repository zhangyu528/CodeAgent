# CodeAgent Feature Roadmap (Pi-Agent Era)

本文档记录了 CodeAgent 在迁移至 Pi-Agent 内核及 Ink TUI 后的新架构演进路线。

## 核心演进路线

| 优先级 | 功能 ID | 功能名称 | 描述 | 状态 | 相关文档 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **High** | N1 | **新内核与 Ink 集成** | 迁移至 Pi-Agent 内核，并使用 Ink 构建全功能 TUI。 | ✅ 已完成 | [详情](新架构功能需求/N1_新内核与Ink集成.md) |
| **High** | N2 | **多 Provider 支持与 Env 配置** | 支持通过环境变量动态配置 Provider baseUrl，替代硬编码。 | ✅ 已完成 | [详情](新架构功能需求/N2_多Provider支持与Env配置.md) |
| **High** | N3 | **会话生命周期与持久化基线** | 统一 session 生命周期、异步化与原子写入，明确 `/new`、`/history`、`/resume` 语义。 | 📅 待启动 | [详情](新架构功能需求/N3_会话生命周期与持久化基线.md) |
| **High** | N4 | **会话存储抽象与兼容迁移** | 引入 `SessionRepository` 抽象、schema version 与 migration，支持 JSON/SQLite 双实现路径。 | 📅 待启动 | [详情](新架构功能需求/N4_会话存储抽象与兼容迁移.md) |
| **Med** | N5 | **会话治理与检索增强** | 增加归档/删除/导入导出/TTL、history 检索和 session 级 token/cost 聚合。 | 📅 待启动 | [详情](新架构功能需求/N5_会话治理与检索增强.md) |

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

---

## 下一步行动建议
新内核与 Ink TUI 已成功集成 (N1)，多 Provider 配置机制已完善 (N2)。目前已具备基础的文件操作、命令执行与会话管理能力，并支持多 Provider 动态配置。

下一步建议：
1. **N3：会话生命周期与持久化基线**，先补齐会话正确性与稳定性基座。
2. **N4：会话存储抽象与兼容迁移**，为后续 SQLite 与治理能力做接口解耦。


