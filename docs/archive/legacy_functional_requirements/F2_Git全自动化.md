# Feature 需求：F2 - Git 全自动化 (Git Automation)

## 1. 背景与目标
目前 Agent 修改代码后，用户需要手动检查并运行 Git 命令进行提交。这打断了“思考-修改-交付”的自动化闭环。

**目标**：赋予 Agent 使用 Git 的能力，使其能像真实开发者一样管理代码版本。

## 2. 核心功能点

### 2.1 智能 Commit (`git_commit`)
- **功能**：自动暂存更改并生成提交。
- **要求**：
  - Agent 应能根据修改内容自动生成符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范的消息。
  - 支持指定文件暂存或全局暂存 (`git add .`)。

### 2.2 分支管理 (`git_branch_management`)
- **功能**：创建、切换及删除分支。
- **场景**：当 Agent 识别出这是一个大型 feature 时，应主动提议创建新分支。

### 2.3 PR/MR 描述生成 (`git_generate_pr`)
- **功能**：对比分支差异，生成详细的任务达成报告，准备合并。

## 3. 验收标准
- [ ] Agent 能独立完成：修改代码 -> 自动 commit -> 编写有意义的消息。
- [ ] 所有 Git 操作需经过 `SecurityLayer` 审核（如禁止强制推送到主分支）。
- [ ] 能够处理基本的 Git 冲突报错并向用户求助。

## 4. 技术方案
- 封装 `git` 命令行工具。
- 在 `AgentController` 层面增加“提交意图”识别。
