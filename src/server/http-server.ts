import "dotenv/config";
import http from "node:http";
import crypto from "node:crypto";
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
const serverApiKey = process.env.SERVER_API_KEY;
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? "60000");
const maxConcurrency = Number(process.env.MAX_CONCURRENCY ?? "2");
const logFilePath = process.env.LOG_FILE_PATH;

if (!apiKey || !model) {
  throw new Error("Missing GLM_API_KEY or GLM_MODEL env var.");
}

const engine = new LLMEngine();
engine.registerProvider(new GLMProvider({ apiKey, baseUrl }));

const toolSystem = new ToolSystem([EchoTool, ReadFileTool, RunCommandTool]);
const controller = new AgentController(engine, toolSystem, "glm");
let activeRequests = 0;

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/run") {
    const traceId = crypto.randomUUID();
    const startTime = Date.now();

    if (!authorizeRequest(req, serverApiKey)) {
      logRequest(traceId, req.method, req.url, 401, startTime, "unauthorized");
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized", traceId }));
      return;
    }

    if (activeRequests >= maxConcurrency) {
      logRequest(traceId, req.method, req.url, 429, startTime, "rate_limited");
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Too many requests", traceId }));
      return;
    }

    activeRequests += 1;
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body) as RunRequest;
        const result = await withTimeout(controller.run(parsed.task, model), requestTimeoutMs);
        const payload: RunResponse = { result };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
        logRequest(traceId, req.method, req.url, 200, startTime);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes("timeout") ? 504 : 400;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message, traceId }));
        logRequest(traceId, req.method, req.url, status, startTime, message);
      } finally {
        activeRequests = Math.max(0, activeRequests - 1);
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

function authorizeRequest(req: http.IncomingMessage, key: string | undefined): boolean {
  if (!key) {
    return true;
  }
  const header = req.headers["authorization"];
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim() === key;
  }
  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string") {
    return apiKeyHeader.trim() === key;
  }
  return false;
}

function logRequest(
  traceId: string,
  method: string | undefined,
  url: string | undefined,
  status: number,
  startTime: number,
  error?: string
) {
  const duration = Date.now() - startTime;
  const parts = [
    "[request]",
    `traceId=${traceId}`,
    `method=${method ?? ""}`,
    `path=${url ?? ""}`,
    `status=${status}`,
    `durationMs=${duration}`,
    error ? `error=${JSON.stringify(error)}` : undefined,
  ].filter(Boolean);
  const line = parts.join(" ");
  console.log(line);
  if (logFilePath) {
    void appendLog(line);
  }
}

async function appendLog(line: string) {
  try {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(logFilePath, `${line}\n`, "utf-8");
  } catch {
    // best-effort logging
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Request timeout"));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}
