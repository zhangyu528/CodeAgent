# Coding Agent MVP 模块与开发顺序

## 一、MVP模块列表

Coding Agent 的 MVP 版本建议包含以下模块：

1.  LLM Engine\
2.  Tool System\
3.  Agent Controller\
4.  Execution Environment\
5.  Planner\
6.  Memory\
7.  Security Layer\
8.  Observability\
9.  CLI Interface

  模块                    作用
  ----------------------- ---------------------
  LLM Engine              调用模型
  Tool System             提供操作能力
  Agent Controller        控制 Agent 执行流程
  Execution Environment   执行代码和命令
  Planner                 任务拆解
  Memory                  上下文管理
  Security Layer          基础安全控制
  Observability           日志和调试
  CLI Interface           用户交互

------------------------------------------------------------------------

# 二、开发优先级

按照依赖关系可以划分为四个优先级阶段。

## P0：核心基础模块

最优先开发：

-   LLM Engine
-   Tool System
-   Agent Controller

原因：

Coding Agent 的最小能力是：

LLM → Tool → Result

必须先实现：

-   LLM调用
-   工具执行
-   Agent流程控制

------------------------------------------------------------------------

## P1：执行能力模块

在核心模块之后实现：

-   Execution Environment
-   Planner

作用：

Execution Environment：

-   运行 shell
-   执行测试
-   执行代码

Planner：

-   任务拆解
-   多步骤执行

此时系统已经可以完成基本任务。

------------------------------------------------------------------------

## P2：稳定性模块

在系统能运行之后增加：

-   Memory
-   Security Layer

Memory：

-   上下文管理
-   历史记录
-   任务状态

Security Layer：

-   workspace 限制
-   command allowlist
-   路径检查

------------------------------------------------------------------------

## P3：可用性模块

最后实现：

-   Observability
-   CLI Interface

Observability：

-   日志
-   调试信息
-   执行记录

CLI Interface：

-   用户交互入口
-   CLI 调用 Agent Core

------------------------------------------------------------------------

# 三、完整开发顺序

推荐开发顺序如下：

1.  LLM Engine\
2.  Tool System\
3.  Agent Controller\
4.  Execution Environment\
5.  Planner\
6.  Memory\
7.  Security Layer\
8.  Observability\
9.  CLI Interface

------------------------------------------------------------------------

# 四、核心里程碑

## 第一阶段：Agent Core

完成：

-   LLM Engine
-   Tool System
-   Agent Controller

系统能力：

LLM → Tool → Result

------------------------------------------------------------------------

## 第二阶段：Agent Loop

增加：

-   Execution Environment
-   Planner

系统能力：

User Task\
↓\
LLM\
↓\
Plan\
↓\
Tool\
↓\
Result

此时 Agent 已经具备基本功能。

------------------------------------------------------------------------

## 第三阶段：系统完善

增加：

-   Memory
-   Security
-   Observability
-   CLI

系统能力：

-   稳定运行
-   可调试
-   可交互

------------------------------------------------------------------------

# 五、开发顺序原则

Coding Agent 的开发顺序遵循三个原则：

### 1. 先核心逻辑

优先实现：

-   LLM
-   Tool
-   Agent Loop

### 2. 再执行能力

增加：

-   Execution
-   Planner

### 3. 最后接口

最后实现：

-   CLI
-   UI

Interface 不应该影响核心逻辑。

------------------------------------------------------------------------

# 六、MVP开发目标

完成上述模块后，Agent 应具备基本能力：

-   读取代码
-   修改代码
-   执行命令
-   运行测试

示例任务：

agent run "fix failing test"

即可完成 Coding Agent MVP。
