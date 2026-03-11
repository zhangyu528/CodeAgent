# Implementation Plan: F6 - Workspace Authorization (Trust Mode)

该计计划旨在为 CodeAgent 增加工作区授权机制，增强安全性，防止 Agent 在非预期目录下执行高危操作。

## 方案设计

### 1. 安全层增强 (`SecurityLayer.ts`)
- 新增 `getTrustStatus()`: 检查当前工作区是否已在信任列表中。
- 新增 `grantTrust()`: 将当前工作区的绝对路径保存到全局信任文件。

### 2. 全局配置存储
- 路径：`~/.codeagent/config.json` (使用 `os.homedir()`)。
- 格式：
  ```json
  {
    "trustedWorkspaces": [
      "/absolute/path/to/workspace1",
      "/absolute/path/to/workspace2"
    ]
  }
  ```

### 3. CLI 入口集成 ([index.ts](file:///d:/work/project/CodeAgent/src/index.ts))
- 在启动 REPL 之前，检查当前目录的信任状态。
- 如果不信任，显示交互式确认：
  - **Yes**: 调用 `grantTrust()` 并继续。
  - **No**: 显示安全提示并 `process.exit(0)`。

## 待修改文件

### [MODIFY] [security_layer.ts](file:///d:/work/project/CodeAgent/src/controller/security_layer.ts)
- 引入 `fs` 和 `os` 模块。
- 实现信任检测与记录逻辑。

### [MODIFY] [index.ts](file:///d:/work/project/CodeAgent/src/index.ts)
- 在 [main()](file:///d:/work/project/CodeAgent/src/controller/planner.ts#61-106) 函数开始处注入 `promptWorkspaceTrust()` 逻辑。

## 验证计划

1. **首次启动阶段**：
   - 切换到一个新目录运行 `node dist/index.js`。
   - 验证是否出现确认对话框。
   - 选择 `No`，验证程序是否安全退出。

2. **授权阶段**：
   - 再次启动，选择 `Yes`。
   - 验证 Agent 是否正常开启。

3. **二次启动阶段**：
   - 关闭并再次重启。
   - 验证是否已跳过授权提示，直接进入 `CodeAgent >`。
