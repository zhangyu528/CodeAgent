# CLI REPL 实施计划（含说明与关键代码）

本计划用于实现具备持久记忆、流式响应体验、基本控制指令的终端 REPL 对话界面。

## 总体目标

- CLI 结构：`run` / `chat` / `config`
- REPL：`/help`、`/exit`、`/reset`
- 流式响应：逐 token 输出
- 持久记忆：每轮写入 VectorStore

## 1) CLI 结构

**说明**  
CLI 负责命令路由，`chat` 进入 REPL，`run` 单次任务执行，`config` 配置管理。

**关键代码片段（`src/cli/index.ts`）**
```ts
program.command("run")
  .argument("<task>")
  .action(async (task) => {
    const controller = buildController();
    const result = await controller.run(task, model);
    console.log(result);
  });

program.command("chat")
  .action(async () => {
    const controller = buildController();
    await startRepl(controller, model);
  });
```

## 2) REPL 入口

**说明**  
REPL 负责循环读写与指令控制，`/reset` 只清空短期上下文，不清除长期记忆。

**关键代码片段（`src/cli/repl.ts`）**
```ts
while (true) {
  const line = (await rl.question("> ")).trim();
  if (line === "/help") { console.log(HELP_TEXT); continue; }
  if (line === "/exit") break;
  if (line === "/reset") { history.length = 0; continue; }

  const answer = await controller.run(buildTask(line, history), model);
  console.log(answer);
  history.push({ role: "user", content: line });
  history.push({ role: "assistant", content: answer });
}
```

## 3) 流式响应

**说明**  
扩展 Provider 支持 `generateStream`，REPL 逐 token 输出。

**关键代码片段（接口扩展）**
```ts
export interface LLMProvider {
  generate(...): Promise<LLMResponse>;
  generateStream(...): AsyncIterable<string>;
}
```

**关键代码片段（REPL 输出）**
```ts
for await (const chunk of controller.runStream(task, model, onChunk)) {
  // onChunk -> process.stdout.write(chunk)
}
```

## 4) 持久记忆写入 VectorStore

**说明**  
每轮对话结束，将 user/assistant 内容写入 VectorStore。

**关键代码片段**
```ts
await store.add(`User: ${line}\nAssistant: ${answer}`, {
  source: "repl",
  timestamp: new Date().toISOString(),
});
```

## 验证计划

1. `npm run cli -- config list` 能输出配置  
2. `npm run cli -- run "Read README"` 能正常返回  
3. `npm run cli -- chat` 验证 `/help /reset /exit`  
4. 流式输出逐 token 可见  
5. `.memory/vector-store.json` 有新增记录

