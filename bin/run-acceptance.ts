import "dotenv/config";
import { LLMEngine } from "../src/llm/engine.js";
import { AgentController } from "../src/agent/controller.js";
import { ToolSystem } from "../src/tools/tool-system.js";
import { EchoTool } from "../src/tools/echo-tool.js";
import { ReadFileTool } from "../src/tools/read-file-tool.js";
import { GLMProvider } from "../src/providers/glm.js";

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

const toolSystem = new ToolSystem([EchoTool, ReadFileTool]);
const controller = new AgentController(engine, toolSystem, "glm");

const task =
  "Read README.md using the read_file tool and then summarize its key points in 3 bullet points.";

console.log("[acceptance] Starting LLM -> Tool -> Result loop...");

const result = await controller.run(task, model);

console.log("[acceptance] Final answer:");
console.log(result);
