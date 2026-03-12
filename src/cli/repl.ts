import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
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

export async function startRepl(controller: AgentController, model: string): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const history: ChatTurn[] = [];
  const store = new VectorStore({ provider: resolveEmbeddingProvider() });
  await store.load();

  console.log("CodeAgent REPL started. Type /help for commands.");

  while (true) {
    const line = (await rl.question("> ")).trim();
    if (!line) {
      continue;
    }

    if (line === "/help") {
      console.log(HELP_TEXT);
      continue;
    }
    if (line === "/exit") {
      break;
    }
    if (line === "/reset") {
      history.length = 0;
      console.log("Session context cleared.");
      continue;
    }

    const task = buildTask(line, history);
    let answer = "";
    answer = await controller.runStream(task, model, (chunk) => {
      process.stdout.write(chunk);
      answer += chunk;
    });
    process.stdout.write("\n");

    history.push({ role: "user", content: line });
    history.push({ role: "assistant", content: answer });

    await store.add(`User: ${line}\nAssistant: ${answer}`, {
      source: "repl",
      timestamp: new Date().toISOString(),
    });
  }

  rl.close();
}

function buildTask(inputText: string, history: ChatTurn[]): string {
  if (history.length === 0) {
    return inputText;
  }
  const recent = history.slice(-6).map((turn) => `${turn.role}: ${turn.content}`).join("\n");
  return `Conversation so far:\n${recent}\n\nUser: ${inputText}`;
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
