import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LLMEngine } from "../src/llm/engine.js";
import { Planner } from "../src/agent/planner.js";
import { ToolSystem } from "../src/tools/tool-system.js";
import { EchoTool } from "../src/tools/echo-tool.js";
import { ReadFileTool } from "../src/tools/read-file-tool.js";
import { RunCommandTool } from "../src/tools/run-command-tool.js";
import { GLMProvider } from "../src/providers/glm.js";
import type { Message } from "../src/types.js";

const apiKey = process.env.GLM_API_KEY;
const baseUrl = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const model = process.env.GLM_MODEL;

if (!apiKey) {
  throw new Error("Missing GLM_API_KEY env var.");
}

if (!model) {
  throw new Error("Missing GLM_MODEL env var.");
}

if (!process.env.GLM_BASE_URL) {
  console.warn(
    "GLM_BASE_URL not set. Using placeholder https://open.bigmodel.cn/api/paas/v4 . Set GLM_BASE_URL if your endpoint differs."
  );
}

const engine = new LLMEngine();
engine.registerProvider(new GLMProvider({ apiKey, baseUrl }));

const toolSystem = new ToolSystem([EchoTool, ReadFileTool, RunCommandTool]);
const planner = new Planner(engine, "glm", toolSystem.listDefinitions().map((tool) => tool.name));

const task =
  "Run npm test. If it fails, analyze the first error and suggest a fix. Return concise steps.";

console.log("[p1-acceptance] Planning...");

const plan = await planner.plan(task, model);

console.log("[p1-acceptance] Plan:");
console.log(JSON.stringify(plan, null, 2));

const toolResults: Array<{ stepId: string; tool: string; result: unknown }> = [];

for (const step of plan) {
  if (!step.tool) {
    continue;
  }
  console.log(`[p1-acceptance] Executing step ${step.id}: ${step.action}`);
  try {
    const result = await toolSystem.execute(step.tool, step.args ?? {});
    toolResults.push({ stepId: step.id, tool: step.tool, result });
  } catch (error) {
    console.error(
      `[p1-acceptance] Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
    break;
  }
}

const summaryTask = [
  "You are given a task, its plan, and tool results.",
  "Provide a concise final response strictly based on the tool results.",
  "If the tool results show a failure, explain the failure and suggest next steps.",
  "Do not claim actions were executed unless shown in tool results.",
  "Task:",
  task,
  "Plan:",
  JSON.stringify(plan),
  "Tool Results:",
  JSON.stringify(toolResults),
].join("\n");

const messages: Message[] = [
  { role: "system", content: await loadPrompt("system.md") },
  { role: "system", content: await loadPrompt("developer.md") },
  { role: "user", content: summaryTask },
];

const finalAnswer = await engine.generate("glm", messages, {
  model,
  tool_choice: "none",
  temperature: 0,
});

console.log("[p1-acceptance] Final answer:");
console.log(finalAnswer.content ?? "");

async function loadPrompt(filename: string): Promise<string> {
  const promptPath = path.resolve(process.cwd(), "prompts", filename);
  try {
    const content = await readFile(promptPath, "utf-8");
    return content.trim();
  } catch {
    return "";
  }
}
