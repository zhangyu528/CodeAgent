# CodeAgent Feature Roadmap & 看板

本文档记录了 CodeAgent 从“引擎研发”转向“功能驱动 (Feature-driven)”后的路线图。每个 Feature 都会经历从“规划”到“里程碑达成”的全生命周期。

## 核心演进路线 (Legacy V1)

| 优先级 | 功能 ID | 功能名称 | 描述 | 状态 | 相关文档 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **High** | F1 | **源码全局感知** | 支持 codebase 级别的语义搜索与符号理解。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F1_源码全局感知.md) |
| **High** | F2 | **Git 全自动化** | 自动 commit, 自动分支管理, 生成高质量 PR 说明。 | 📅 待启动 | [详情](archive/legacy_functional_requirements/F2_Git全自动化.md) |
| **Med** | F3 | **环境自动上下文** | 启动时自动读取 README/JSON/Tree 注入上帝视角。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F3_环境自动上下文.md) |
| **Med** | F4 | **多模型多 Provider** | 支持集成 DeepSeek, OpenAI 以及动态模型切换。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F4_多模型多Provider.md) |
| **Low** | F5 | **浏览器增强** | 具备 Web Search 能力，查询最新文档与错误。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F5_浏览器增强.md) |
| **High** | F6 | **工作区授权** | 启动时提示信任当前目录，防误触。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F6_工作区授权.md) |
| **High** | F7 | **CLI 交互式会话** | 支持流式输出、Token滑窗记忆与多行输入的高效终端对话模式。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F7_CLI交互式会话.md) |
| **Med** | F8 | **CLI 高级交互增强** | 代码 Diff 可视化、工具执行进度折叠及快捷键支持。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F8_CLI高级交互增强.md) |
| **High** | F9 | **CLI 界面全功能** | 流式输出、状态栏、快捷键系统及 TTY 优化。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F9%20-%20CLI%20%E7%95%8C%E9%9D%A2%E5%85%A8%E5%8A%9F%E8%83%BD%E9%9C%80%E6%B1%82%EF%BC%88Streaming%20UI%20+%20Status%20Bar%20+%20Keybindings%EF%BC%89.md) |
| **Low** | F10 | **调整 CLI 欢迎横幅** | 彩色图案、极简显示、版本与 Provider 间隔。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F10%20%E8%B0%83%E6%95%B4%20CLI%20%E6%AC%A2%E8%BF%8E%E6%A8%AA%E5%B9%B5.md) |
| **High** | F11 | **初始化向导** | 首次运行自动引导配置 API Key，推荐代码模型。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F11_%E5%88%9D%E5%A7%8B%E5%8C%96%E5%90%91%E5%AF%BC_%E5%AE%9E%E7%8E%B0%E8%AE%A1%E5%88%92.md) |
| **High** | F12 | **交互式模型管理** | `/model` 和 `/provider` 交互式列表切换。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F12_%E4%BA%A4%E4%BA%92%E5%BC%8F%E6%A8%A1%E5%9E%8B%E7%AE%A1%E7%90%86_%E5%AE%9E%E7%8E%B0%E8%AE%A1%E5%88%92.md) |
| **Med** | F13 | **交互式命令菜单** | 输入 `/` 即触发分类分组菜单，并支持实时指令预览。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F13_交互式命令菜单增强.md) |
| **High** | F14 | **架构重构：解耦 Index** | 拆分上帝对象，提取 Factory、TerminalManager 与 REPL。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F14_%E6%9E%B6%E6%9E%84%E9%87%8D%E6%9E%84_%E8%A7%A3%E8%80%A6Index.md) |
| **Med** | F15 | **输入框视觉效果改善** | 引入双行提示符、Context Line 及视觉分隔线。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F15_%E8%BE%93%E5%85%A5%E6%A1%86%E6%94%B9%E5%96%84_%E5%AE%9E%E7%8E%B0%E8%AE%A1%E5%88%92.md) |
| **Med** | F16 | **TTY 交互体验优化** | Ctrl+C 退出、ESC 中断/清空、F9 切换状态栏。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F16_TTY%E4%BA%A4%E4%BA%92%E4%BD%93%E9%AA%8C%E4%BC%98%E5%8C%96.md) |
| **High** | F17 | **架构重构：CLI 与 Runtime 分离** | 六边形架构，核心逻辑与 UI 彻底解耦，支持 JSON-RPC 桥接 macOS App。 | ✅ 已完成 | [详情](archive/legacy_functional_requirements/F17_%E6%9E%B6%E6%9E%84%E9%87%8D%E6%9E%84_Runtime%E5%88%86%E7%A6%BB.md) |

---

## 新架构演进路线 (Pi-Agent Era)

| 优先级 | 功能 ID | 功能名称 | 描述 | 状态 | 相关文档 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **High** | N1 | **新内核与 Ink 集成** | 迁移至 Pi-Agent 内核，并使用 Ink 构建全功能 TUI。 | ✅ 已完成 | [详情](新架构功能需求/N1_新内核与Ink集成.md) |
| **High** | N2 | **Git 全自动化** | 自动 commit, 自动分支管理, 生成高质量 PR 说明。 | 📅 待启动 | [详情](archive/legacy_functional_requirements/F2_Git全自动化.md) |
| **Med** | N3 | **Web 工具增强** | 移植 `web_search` 与 `browse_page` 到新内核。 | 📅 待启动 | [详情](archive/legacy_functional_requirements/F5_浏览器增强.md) |

---

## 2026 Q1 里程碑达成看板

> 此处记录已合入主分支的功能特性。

### [已达成] P0-P4：核心引擎基座
- **达成时间**：2026-03-11
- **[已达成] N1：新内核与 Ink 集成**
  - **达成时间**：2026-03-22
- **[已达成] F1：源码全局感知**
  - **达成时间**：2026-03-11
- **[已达成] F3：环境自动上下文**
  - **达成时间**：2026-03-11
- **[已达成] F4：多模型多 Provider**
  - **达成时间**：2026-03-11
- **[已达成] F5：浏览器增强**
  - **达成时间**：2026-03-11
- **[已达成] F6：工作区授权**
  - **达成时间**：2026-03-11
- **[已达成] F7：CLI 交互式会话**
  - **达成时间**：2026-03-11
- **[已达成] F8：CLI 高级交互增强**
  - **达成时间**：2026-03-12
- **[已达成] F9：CLI 界面全功能**
  - **达成时间**：2026-03-12
- **[已达成] F10：调整 CLI 欢迎横幅**
  - **达成时间**：2026-03-12
- **[已达成] F11：初始化向导**
  - **达成时间**：2026-03-12
- **[已达成] F12：交互式模型管理**
  - **达成时间**：2026-03-13
- **[已达成] F13：交互式命令菜单**
  - **达成时间**：2026-03-13
- **[已达成] F14：架构重构：解耦 Index**
  - **达成时间**：2026-03-14
- **[已达成] F15：输入框视觉效果改善**
  - **达成时间**：2026-03-14
- **[已达成] F16：TTY 交互体验优化**
  - **达成时间**：2026-03-15
- **[已达成] F17：架构重构：CLI 与 Runtime 分离**
  - **达成时间**：2026-03-16


---

## 下一步行动建议
新内核与 Ink TUI 已成功集成 (N1)。目前已具备基础的文件操作、命令执行与会话管理能力。

下一步建议：
1. **N3：Web 工具增强**，将原有的 Web 搜索能力移植到新内核。
2. **N2：Git 全自动化**，实现代码管理闭环。
