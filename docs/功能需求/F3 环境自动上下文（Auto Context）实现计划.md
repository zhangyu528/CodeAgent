**F3 环境自动上下文（Auto Context）实现计划**

**Summary**
在启动流程中生成“引导快照”，包含 README 摘要、package.json 关键字段与 2 层目录树；压缩到 500 tokens 以内，并注入到 System Prompt 末尾，保证不会被 MemoryManager 截断。

**Key Changes**
1. **新增 ContextInformer 模块**
   - 新增 `src/controller/context_informer.ts`（或 `src/utils/context_informer.ts`）：
     - `buildBootSnapshot(rootDir: string): Promise<string>`
     - 读取 `README.md`（优先 `README.md`，不存在则尝试 `README*.md`）
     - 读取 `package.json`（若不存在则跳过）
     - 生成 2 层目录树，默认忽略：`.git`, `node_modules`, `dist`, `build`, `temp`, `coverage`（可在常量中配置）
     - 结果合成为中文摘要：项目简介 + 技术栈 + 脚本入口 + 目录概览
2. **System Prompt 支持注入快照**
   - 修改 `src/prompts/system_prompt.ts`：
     - `getSystemPrompt(context?: { bootSnapshot?: string })`
     - 若存在 `bootSnapshot`，追加到 System Prompt 的“Context & Environment”之后
3. **启动流程注入**
   - 修改 `src/index.ts`：
     - 在 `createAgent()` 中初始化 `ContextInformer`
     - 生成快照后调用 `getSystemPrompt({ bootSnapshot })`
     - 注入 `MemoryManager.setSystemPrompt(...)`
4. **Token 控制**
   - 在 `ContextInformer` 中实现简易 token 估算（沿用 4 chars/token 规则）
   - 若超过 500 tokens，按优先级裁剪：
     1. README 摘要截断
     2. 目录树行数截断
     3. package.json 依赖列表简化为计数

**API/Interface Changes**
- `getSystemPrompt` 新增可选参数：`bootSnapshot?: string`
- `ContextInformer.buildBootSnapshot(rootDir)` 新增模块接口

**Test Plan**
1. Unit test：`buildBootSnapshot` 输出包含 README 标题与 package.json 的 `name`、`scripts` 概要
2. Unit test：超大 README + 深树时仍能压缩至 500 tokens（估算规则一致）
3. Manual check：启动后直接询问“这个项目是做什么的”，回答包含 README / 技术栈 / 目录概览

**Assumptions**
- README 优先 `README.md`；不存在则尝试 `README*.md` 中首个匹配
- 目录树默认深度为 2，忽略目录清单固定在代码中（后续可参数化）
- Token 估算继续使用 4 chars/token 的简易规则，与 MemoryManager 方式一致
