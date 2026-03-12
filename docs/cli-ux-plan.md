# CLI 交互体验增强计划（彩色输出 + 进度显示）

目标：在 CLI/REPL 中引入彩色输出与进度提示，提升可读性与体验。

## 关键变更

1) 依赖引入  
- `chalk`：彩色输出  
- `ora`：进度/Spinner  

2) 输出规范  
- info：蓝色  
- warn：黄色  
- error：红色  
- success：绿色  

3) REPL 交互增强  
在调用 LLM 时显示 spinner，开始输出后停止 spinner。  

关键代码片段（`src/cli/repl.ts`）：
```ts
import ora from "ora";
import chalk from "chalk";

const spinner = ora("Thinking...").start();
const answer = await controller.runStream(task, model, (chunk) => {
  spinner.stop();
  process.stdout.write(chunk);
});
process.stdout.write("\n");
```

4) CLI 命令反馈增强  
对 run/config/chat 输出加颜色，错误高亮。

关键代码片段（`src/cli/index.ts`）：
```ts
console.log(chalk.blue("Running task..."));
logger.warn(chalk.yellow("Missing config key"));
logger.error(chalk.red("Failed to execute"));
```

## 验证计划

1. `npm run cli -- run "task"`  
   - spinner 显示/消失  
   - 输出带颜色  
2. `npm run cli -- chat`  
   - 输入后显示 spinner  
   - 流式输出中 spinner 停止  
