# CodeAgent Feature Roadmap (Pi-Agent Era)

本文档记录了 CodeAgent 在迁移至 Pi-Agent 内核及 Ink TUI 后的新架构演进路线。

## 核心演进路线

| 优先级 | 功能 ID | 功能名称 | 描述 | 状态 | 相关文档 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **High** | N1 | **新内核与 Ink 集成** | 迁移至 Pi-Agent 内核，并使用 Ink 构建全功能 TUI。 | ✅ 已完成 | [详情](新架构功能需求/N1_新内核与Ink集成.md) |
| **High** | N2 | **Git 全自动化** | 自动 commit, 自动分支管理, 生成高质量 PR 说明。 | 📅 待启动 | [详情](archive/legacy_functional_requirements/F2_Git全自动化.md) |
| **Med** | N3 | **Web 工具增强** | 移植 `web_search` 与 `browse_page` 到新内核。 | 📅 待启动 | [详情](archive/legacy_functional_requirements/F5_浏览器增强.md) |
| **Med** | N4 | **代码 Diff 可视化** | 在 Ink TUI 中实现优雅的代码 Diff 预览。 | 📅 待启动 | - |

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

---

## 下一步行动建议
新内核与 Ink TUI 已成功集成 (N1)。目前已具备基础的文件操作、命令执行与会话管理能力。

下一步建议：
1. **N3：Web 工具增强**，将原有的 Web 搜索能力移植到新内核。
2. **N2：Git 全自动化**，实现代码管理闭环。
