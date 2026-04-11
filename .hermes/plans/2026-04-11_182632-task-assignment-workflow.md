# 项目分析 → 任务分配 → Agent 执行 → 测试验证 → 报告

## Goal

基于 `project-analysis` skill 生成的分析报告，自动拆解任务并分配给 sub-agent 执行，完成后确保自动化测试通过，最终生成汇总报告发送到飞书。

## Current Context / Assumptions

- 已有 `project-analysis` skill，每小时生成项目分析报告（发送飞书）
- 已有 `feishu_webhook.py` 发送脚本
- Hermes 支持 `delegate_task` 创建 sub-agent
- 项目有测试（`tests/` 目录）
- 当前 cron job 流程：skill 分析 → 发飞书

## Proposed Approach

### 核心思路

将现有的"每小时分析报告"升级为"每小时任务执行 + 报告"：

```
Cron 触发
  → project-analysis skill 分析项目
  → LLM 根据报告生成可执行任务列表
  → 对每个任务启动 sub-agent 执行
  → 所有任务完成后运行测试验证
  → 生成汇总报告发送到飞书
```

### 两种方案

#### 方案 A：完全自动化（推荐）

Cron job 触发后，所有步骤自动完成，无需人工介入。

**流程：**
1. Skill 分析项目代码，生成详细报告
2. LLM 根据报告 + 当前代码状态，生成 3-5 个可执行的 TODO/FIXME 任务
3. 对每个任务启动 sub-agent（`delegate_task`），每个 agent：
   - 修改对应代码
   - 编写或更新相关测试
   - 验证测试通过
4. 所有 agent 完成后，运行完整测试套件
5. 生成汇总报告（完成的任务、跳过的任务、测试结果）
6. 通过 `feishu_webhook.py` 发送到飞书

**优点：** 全自动，持续改进
**缺点：** 可能改坏代码，风险较高

#### 方案 B：人工确认后执行

Cron 触发后，生成任务列表，先发飞书通知，用户确认后再执行。

**流程：**
1. Skill 分析项目，生成报告 + 任务建议
2. 发飞书给用户列出任务清单（带编号）
3. 用户回复编号确认要执行的任务
4. Hermes 接收用户回复，启动对应 sub-agent
5. 执行 → 测试 → 报告

**优点：** 安全可控
**缺点：** 需要人工介入，不是完全自动化

## Step-by-Step Plan

### Phase 1: 创建任务生成 Skill

**新建 skill：** `task-generator`

- 输入：`project-analysis` 的报告内容
- 输出：结构化的任务列表（JSON 格式）
- 每个任务包含：
  - `title`: 任务标题
  - `description`: 任务描述
  - `file`: 需要修改的文件
  - `priority`: high/medium/low
  - `estimated_time`: 预估时间

**文件：** `~/.hermes/skills/productivity/task-generator/SKILL.md`

### Phase 2: 修改 project-analysis Skill

在现有 `project-analysis` SKILL.md 末尾添加：

```markdown
## 任务生成（可选）

如果需要自动生成任务，在分析完成后调用 task-generator skill。
```

### Phase 3: 创建任务执行 Skill

**新建 skill：** `task-executor`

- 接收任务定义
- 使用 `delegate_task` 启动 sub-agent
- 监控 sub-agent 完成状态
- 验证测试通过

**文件：** `~/.hermes/skills/productivity/task-executor/SKILL.md`

### Phase 4: 创建汇总报告 Skill

**新建 skill：** `execution-report`

- 汇总所有任务执行结果
- 格式化输出为飞书消息
- 调用 `feishu_webhook.py` 发送

**文件：** `~/.hermes/skills/productivity/execution-report/SKILL.md`

### Phase 5: 更新 Cron Job

**修改 cron job prompt：**

```
1. 使用 project-analysis skill 分析 /mnt/d/work/project/CodeAgent
2. 使用 task-generator skill 生成任务列表
3. 使用 task-executor skill 执行每个任务
4. 使用 execution-report skill 生成汇总报告并发送飞书
```

**Cron 配置：**
- schedule: `0 * * * *`（每小时）
- deliver: `local`
- skills: `["project-analysis", "task-generator", "task-executor", "execution-report"]`

## Files to Change / Create

### 新建

| File | Description |
|------|-------------|
| `~/.hermes/skills/productivity/task-generator/SKILL.md` | 任务生成 skill |
| `~/.hermes/skills/productivity/task-executor/SKILL.md` | 任务执行 skill |
| `~/.hermes/skills/productivity/execution-report/SKILL.md` | 汇总报告 skill |
| `scripts/feishu_webhook.py` | 已存在，复用 |

### 修改

| File | Description |
|------|-------------|
| `~/.hermes/skills/productivity/project-analysis/SKILL.md` | 添加任务生成步骤 |

## Risks & Tradeoffs

### 风险

1. **改坏代码**：sub-agent 修改可能引入 bug → 缓解：每个任务执行后立即跑测试
2. **测试覆盖不足**：如果没有测试，任务执行后无法验证 → 缓解：强制要求每个任务附带测试
3. **无限循环**：任务生成 → 执行 → 新问题 → 新任务 → ... → 缓解：设置最大任务数（3-5个）
4. **执行时间过长**：每小时可能不够 → 缓解：设置任务超时和最大并发

### 权衡

- **方案 A vs 方案 B**：方案 A 更自动化但风险高，方案 B 安全但需要人工介入
- **任务粒度**：任务太大执行时间长，太小又没意义。建议每个任务 5-30 分钟
- **测试策略**：建议 "测试先行"，但项目当前没有 TDD，可以先做 "测试覆盖" 任务

## Open Questions

1. **任务来源**：只从 project-analysis 的 TODO/FIXME 生成，还是可以从任意代码质量问题生成？
2. **并发数**：同时跑几个 sub-agent？（建议最多 2-3 个，避免资源竞争）
3. **失败策略**：任务执行失败怎么办？（跳过/重试/暂停人工介入）
4. **测试框架**：项目用什么测试框架？（jest/vitest/cargo test/...）
5. **是否需要分支策略**？任务在 main 分支直接改还是创建新分支 PR？

## Validation

1. 人为触发一次完整的流程，验证：
   - project-analysis 生成报告 ✅
   - task-generator 生成 3-5 个任务
   - task-executor 执行任务
   - 测试通过
   - 飞书收到汇总报告
2. 确认测试框架和命令正确
3. 确认 sub-agent 的工具权限（terminal/file）足够
