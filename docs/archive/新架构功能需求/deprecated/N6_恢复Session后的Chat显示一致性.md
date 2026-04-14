# 功能需求 N6：恢复 Session 后的 Chat 显示一致性

## 背景与问题
当前 session 恢复能力已具备基础可用性，用户可以通过 `/resume` 或 `/history` 进入已有会话。但从交互一致性角度看，恢复后的 chat UI 仍缺少明确需求边界：
- `/resume` 与 `/history` 选择 session 可能走不同恢复路径，导致 UI 状态收敛不一致。
- 恢复时不仅要还原消息列表，还要保证顶部 session 信息、输入区状态和 overlay 状态同步恢复。
- 恢复失败时若只部分更新 UI，容易出现“标题已切换但消息未切换”或“消息已切换但仍停留在旧弹层”等半恢复状态。

## 目标
- 统一 `/resume` 与 `/history` 选择 session 的 UI 恢复语义。
- 明确恢复成功时 chat 页面应具备的最小一致状态集合。
- 明确恢复失败时的回退行为，避免进入半恢复状态。

## 非目标
- 本阶段不扩展 session 持久化格式或 repository 抽象。
- 本阶段不覆盖恢复后再次发送消息时的持久化连续性。
- 本阶段不引入 history 检索、归档、删除等治理能力。

## 设计要点
### 统一恢复入口
- `/resume` 与 `/history` 选择 session 必须复用同一套 UI 恢复流程。
- 不允许一个入口直接替换消息，另一个入口再单独更新 header 或 page。
- 当前实现要求通过统一的 `restoreSessionById -> restoreSessionToUI` 链路完成恢复，避免入口分叉。

### 恢复成功的最小 UI 状态
恢复成功后，界面必须同时满足：
- 页面进入 `chat`
- 消息列表切换为目标 session 的消息
- chat 顶部 session header 切换为目标 session 元数据
- 输入区处于可继续输入状态
- 历史弹窗、提示弹窗等 overlay 关闭
- `thinking`、`usage`、退出确认、待执行命令等临时 UI 状态被清空
- 恢复消息中的结构化 `content` 需先归一化为可显示文本，不能把对象直接传给 Ink/React 文本节点

### 恢复失败的回退原则
- 若目标 session 不存在、读取失败或解析失败，必须保持当前 UI 不变。
- 恢复失败时仅提示错误，不得更新 page、header、messages 中的任意子集。
- `/resume` 与 `/history` 选择失败时，使用统一提示文案路径，不保留旧 overlay 或半更新状态。

## 用户可见行为
- `/resume`：恢复最近一个可用 session，恢复后立即在 chat 中显示正确消息与 session 信息。
- `/history`：以会话列表弹窗展示历史，选择某个 session 后进入 chat，并显示该 session 的完整 UI 状态。
- 恢复失败：给出明确提示，并保持当前输入上下文与当前页面不变。
- 若历史消息包含 thinking/text 等结构化内容，恢复后应显示为字符串文本，而不是触发渲染错误。

## 验收标准
- Given 当前在 welcome 页面，When 执行 `/resume`，Then 应进入 chat，且消息列表、顶部 session 信息、输入区状态同步恢复。
- Given 当前在任意页面，When 通过 `/history` 选择某个 session，Then 恢复结果与 `/resume` 的 UI 一致性标准相同。
- Given 恢复目标不存在或读取失败，When 执行 `/resume` 或 `/history` 选择，Then 给出明确提示，且当前 UI 不进入半恢复状态。
- Given 恢复前存在 prompt 或 history 弹窗，When 恢复成功，Then overlay 应关闭，输入区进入可继续输入状态。
- Given 恢复前界面残留 `thinking`、`usage` 或退出确认状态，When 恢复成功，Then 这些临时状态应被清空。
- Given session 消息内容中包含对象或结构化片段，When 恢复到 chat，Then 页面应正常渲染，不出现 “Objects are not valid as a React child” 错误。

## 风险与回滚
- 风险：恢复逻辑分散在多个入口，后续修改时容易再次出现状态不一致。
- 缓解：恢复逻辑集中到统一 UI 恢复函数，由各入口复用。
- 回滚：若统一恢复流程引入问题，可暂时退回到单入口修复，但必须保留需求文档中的一致性标准。

## 里程碑
- M1：统一恢复成功/失败的 UI 状态定义。
- M2：`/resume` 与 `/history` 复用同一恢复流程。
- M3：通过恢复一致性回归测试，覆盖 chat、header、input、overlay 与结构化消息渲染五类状态。
