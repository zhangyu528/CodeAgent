import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import ora from "ora";
import chalk from "chalk";
import { AgentController } from "../agent/controller.js";
import { VectorStore } from "../memory/vector-store.js";
import { GLMEmbeddingProvider, HashEmbeddingProvider } from "../memory/embedding-provider.js";

type ChatTurn = { role: "user" | "assistant"; content: string };

const HELP_TEXT = `
Commands:
  /help   Show this help
  /exit   Exit REPL
  /reset  Clear current session context (keeps long-term memory)
`.trim();

import { setApprovalHandler } from "../security/approval-handler.js";

export async function startRepl(controller: AgentController, model: string): Promise<void> {
  const isInteractive = Boolean(input.isTTY && output.isTTY);
  if (!isInteractive) {
    const raw = await readAllStdin();
    const line = raw.trim();
    if (!line) {
      return;
    }
    await runSingleTurn(controller, model, line);
    return;
  }

  // Use a timer to keep the event loop busy
  const keepAlive = setInterval(() => {}, 60_000);
  
  let currentRl: readline.Interface | null = null;
  
  // Dynamic approval handler that uses the active turn's readline interface
  setApprovalHandler(async (message) => {
    if (!currentRl) return false;
    try {
      const answer = await currentRl.question(`\n${chalk.yellow("Approval required:")} ${message} (y/n) `);
      return answer.toLowerCase().startsWith("y");
    } catch {
      return false;
    }
  });

  const history: ChatTurn[] = [];
  const store = new VectorStore({ provider: resolveEmbeddingProvider() });
  await store.load();
  let shouldExit = false;

  console.log(chalk.cyan("CodeAgent REPL started. Type /help for commands."));

  while (true) {
    if (shouldExit) break;
    
    // Create a fresh interface for each turn to avoid TTY sync issues and double-echo
    const rl = readline.createInterface({ input, output });
    currentRl = rl;

    rl.on("SIGINT", () => {
      shouldExit = true;
      rl.close();
    });

    try {
      let raw: string;
      try {
        raw = await rl.question("> ");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          currentRl = null;
          break;
        }
        throw error;
      }

      // We close the interface immediately after receiving the line
      // This ensures that LLM output (stdout) doesn't interfere with readline's TTY state
      rl.close();
      currentRl = null;

      const line = raw.trim();
      if (!line) continue;

      if (line === "/help") {
        console.log(HELP_TEXT);
        continue;
      }
      if (line === "/exit") {
        shouldExit = true;
        break;
      }
      if (line === "/reset") {
        history.length = 0;
        console.log("Session context cleared.");
        continue;
      }

      const task = buildTask(line, history);
      let answer = "";
      const spinner = ora(chalk.gray("Thinking...")).start();
      
      try {
        answer = await controller.runStream(task, model, (chunk) => {
          if (spinner.isSpinning) spinner.stop();
          process.stdout.write(chunk);
          answer += chunk;
        });
        
        if (spinner.isSpinning) spinner.stop();
        console.log(""); 

        history.push({ role: "user", content: line });
        history.push({ role: "assistant", content: answer });

        await store.add(`User: ${line}\nAssistant: ${answer}`, {
          source: "repl",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (spinner.isSpinning) spinner.stop();
        console.error(chalk.red("\n[error] Error processing task:"), error instanceof Error ? error.message : error);
      }
    } catch (loopError) {
      console.error(chalk.red("\n[critical] REPL loop encountered an unexpected error:"), loopError instanceof Error ? loopError.message : loopError);
      shouldExit = true;
      if (currentRl) currentRl.close();
      break;
    }
  }

  clearInterval(keepAlive);
  console.log("REPL exiting.");
}

function buildTask(inputText: string, history: ChatTurn[]): string {
  if (history.length === 0) {
    return inputText;
  }
  // Use a clearer structure for history to help the model distinguish turns
  const recent = history.slice(-10).map((turn) => {
    return `[${turn.role.toUpperCase()}]: ${turn.content}`;
  }).join("\n\n");
  
  return `### OLD CONVERSATION HISTORY\n${recent}\n\n### NEW USER REQUEST\n${inputText}`;
}

function resolveEmbeddingProvider() {
  const provider = (process.env.EMBEDDING_PROVIDER ?? "hash").toLowerCase();
  if (provider === "glm") {
    const apiKey = process.env.GLM_API_KEY;
    const baseUrl = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
    const model = process.env.EMBEDDING_MODEL ?? "embedding-3";
    if (!apiKey) {
      throw new Error("Missing GLM_API_KEY env var for embedding.");
    }
    return new GLMEmbeddingProvider({
      apiKey,
      baseUrl,
      model,
      dimension: Number(process.env.EMBEDDING_DIMENSION ?? "1024"),
    });
  }
  const dimension = Number(process.env.EMBEDDING_DIMENSION ?? "128");
  return new HashEmbeddingProvider(Number.isNaN(dimension) ? 128 : dimension);
}

async function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    input.setEncoding("utf8");
    input.on("data", (chunk) => {
      data += chunk;
    });
    input.on("end", () => resolve(data));
    input.on("error", (error) => reject(error));
  });
}

async function runSingleTurn(controller: AgentController, model: string, line: string) {
  const store = new VectorStore({ provider: resolveEmbeddingProvider() });
  await store.load();
  const spinner = ora(chalk.gray("Thinking...")).start();
  let answer = "";
  answer = await controller.runStream(line, model, (chunk) => {
    if (spinner.isSpinning) {
      spinner.stop();
    }
    process.stdout.write(chunk);
    answer += chunk;
  });
  if (spinner.isSpinning) {
    spinner.stop();
  }
  process.stdout.write("\n");

  await store.add(`User: ${line}\nAssistant: ${answer}`, {
    source: "repl",
    timestamp: new Date().toISOString(),
  });
}
