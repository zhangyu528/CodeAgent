import "dotenv/config";
import http from "node:http";
import { LLMEngine } from "../llm/engine.js";
import { AgentController } from "../agent/controller.js";
import { ToolSystem } from "../tools/tool-system.js";
import { EchoTool } from "../tools/echo-tool.js";
import { ReadFileTool } from "../tools/read-file-tool.js";
import { RunCommandTool } from "../tools/run-command-tool.js";
import { GLMProvider } from "../providers/glm.js";

interface RunRequest {
  task: string;
  sessionId?: string;
}

interface RunResponse {
  result: string;
}

const apiKey = process.env.GLM_API_KEY;
const baseUrl = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const model = process.env.GLM_MODEL;

if (!apiKey || !model) {
  throw new Error("Missing GLM_API_KEY or GLM_MODEL env var.");
}

const engine = new LLMEngine();
engine.registerProvider(new GLMProvider({ apiKey, baseUrl }));

const toolSystem = new ToolSystem([EchoTool, ReadFileTool, RunCommandTool]);
const controller = new AgentController(engine, toolSystem, "glm");

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/run") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body) as RunRequest;
        const result = await controller.run(parsed.task, model);
        const payload: RunResponse = { result };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const port = Number(process.env.PORT ?? "3000");
server.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
