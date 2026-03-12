# Implementation Plan: F1 - 源码全局感知 (Codebase Search)

该计划旨在赋予 CodeAgent 全局代码检索能力，使其能在大中型项目中快速定位逻辑。

## 方案设计

### 1. 新增工具集 (`src/tools/`)

#### 2.1 `search_code` (文本搜索)
- **实现**：遍历工作区文件，使用正则或字符串匹配关键字。
- **优化**：
  - 支持 `includeFiles` (glob) 和 `excludeFiles`。
  - 自动跳过 `node_modules`, `.git`, `dist` 等目录。
  - **Token 保护**：若结果超过 20 个匹配项，仅返回前 20 项并提示 Agent 缩小范围。

#### 2.2 `find_definition` (定义搜索)
- **实现**：针对常见编程语言（TS/JS/Python/Go）预设正则表达式，匹配 `export class`, `interface`, `function` 等。
- **示例正则**：`export\s+(class|interface|function|const)\s+${name}`.

#### 2.3 `list_tree` (文件树)
- **实现**：递归遍历目录，以树状文本格式输出。支持 `depth` 参数（默认为 2）。

### 2. 核心逻辑补强
- **AST 支持**：初期仅使用正则，若正则无法满足复杂场景，后期考虑引入简单的 Parser。

## 待修改/新增文件

### [NEW] [search_code_tool.ts](file:///d:/work/project/CodeAgent/src/tools/search_code_tool.ts)
- 实现全文搜索。

### [NEW] [find_definition_tool.ts](file:///d:/work/project/CodeAgent/src/tools/find_definition_tool.ts)
- 实现符号定位。

### [NEW] [list_tree_tool.ts](file:///d:/work/project/CodeAgent/src/tools/list_tree_tool.ts)
- 实现结构展示。

### [MODIFY] [index.ts](file:///d:/work/project/CodeAgent/src/index.ts)
- 注册三个新工具。

## 验证计划

1. **功能验证**：
   - 搜索 "AgentController" 应该返回对应的定义文件和关键引用。
   - `list_tree` 应该打印出清晰的项目目录。
2. **Token 处理验证**：
   - 在一个大型项目中搜索 "import"，测试是否能正确截断结果并给出提示。
3. **集成验证**：
   - 让 Agent 独立完成："找到 MemoryManager 的定义，并告诉我它是如何处理 Token 截断的"。
