import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LLMEngine } from "../llm/engine.js";
import type { Message } from "../types.js";
import type { ToolSystem } from "../tools/tool-system.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { VectorStore } from "../memory/vector-store.js";
import { GLMEmbeddingProvider, HashEmbeddingProvider } from "../memory/embedding-provider.js";
import { Planner, PlanStep } from "./planner.js";

export class AgentController {
  constructor(
    private engine: LLMEngine,
    private toolSystem: ToolSystem,
    private providerName: string
  ) {}

  async run(task: string, model: string): Promise<string> {
    const planningMode = this.planningMode();
    const planningContext = (process.env.PLANNING_CONTEXT ?? "true").toLowerCase() === "true";
    if (planningMode !== "off" && this.shouldPlan(task, planningMode) && planningContext) {
      return this.runWithPlan(task, model);
    }

    const systemPrompt = await this.loadSystemPrompt();
    const developerPrompt = await this.loadDeveloperPrompt();
    const retrieved = await this.maybeRetrieve(task);
    const memory = new MemoryManager({ maxItems: this.maxMemoryItems() });
    await memory.add({
      role: "system",
      content: systemPrompt,
    });
    await memory.add({
      role: "system",
      content: developerPrompt,
    });
    if (retrieved) {
      await memory.add({
        role: "system",
        content: `Retrieved memory:\n${retrieved}`,
      });
    }
    await memory.add({ role: "user", content: task });

    const maxTurns = 4;

    for (let turn = 0; turn < maxTurns; turn += 1) {
      let response;
      try {
        response = await this.engine.generate(this.providerName, memory.getSnapshot(), {
          model,
          tools: this.toolSystem.listDefinitions(),
          tool_choice: "auto",
        });
      } catch (error) {
        return this.formatError({
          stage: "LLM_REQUEST",
          message: this.errorMessage(error),
        });
      }

      if (response.tool_calls && response.tool_calls.length > 0) {
        await memory.add({
          role: "assistant",
          content: response.content ?? "",
          tool_calls: response.tool_calls,
        });

        for (const call of response.tool_calls) {
          try {
            if (this.logToolCalls()) {
              console.log(
                `[tool_call] ${call.function.name} ${this.truncateJson(call.function.arguments ?? {})}`
              );
            }
            const result = await this.toolSystem.execute(
              call.function.name,
              call.function.arguments
            );
            if (this.logToolCalls()) {
              console.log(`[tool_result] ${call.function.name} -> ${this.truncateJson(result)}`);
            }
            await memory.add({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const stage = this.classifyToolErrorStage(error);
            return this.formatError({
              stage,
              tool: call.function.name,
              args: call.function.arguments ?? null,
              message: this.errorMessage(error),
            });
          }
        }

        continue;
      }

      return response.content ?? "";
    }

    throw new Error("Max turns exceeded without final response.");
  }

  async runStream(
    task: string,
    model: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    if (process.env.DEBUG) {
      console.log(`[debug] Controller.runStream starting for task: ${task.slice(0, 50)}...`);
    }
    const planningMode = this.planningMode();
    const planningContext = (process.env.PLANNING_CONTEXT ?? "true").toLowerCase() === "true";
    if (planningMode !== "off" && this.shouldPlan(task, planningMode) && planningContext) {
      return this.runWithPlanStream(task, model, onChunk);
    }

    const systemPrompt = await this.loadSystemPrompt();
    const developerPrompt = await this.loadDeveloperPrompt();
    const retrieved = await this.maybeRetrieve(task);
    const memory = new MemoryManager({ maxItems: this.maxMemoryItems() });
    await memory.add({ role: "system", content: systemPrompt });
    await memory.add({ role: "system", content: developerPrompt });
    if (retrieved) {
      await memory.add({ role: "system", content: `Retrieved memory:\n${retrieved}` });
    }
    await memory.add({ role: "user", content: task });

    const maxTurns = 4;
    for (let turn = 0; turn < maxTurns; turn += 1) {
      let response;
      try {
        response = await this.engine.generate(this.providerName, memory.getSnapshot(), {
          model,
          tools: this.toolSystem.listDefinitions(),
          tool_choice: "auto",
        });
      } catch (error) {
        return this.formatError({
          stage: "LLM_REQUEST",
          message: this.errorMessage(error),
        });
      }

      if (response.tool_calls && response.tool_calls.length > 0) {
        await memory.add({
          role: "assistant",
          content: response.content ?? "",
          tool_calls: response.tool_calls,
        });

        for (const call of response.tool_calls) {
          try {
            if (this.logToolCalls()) {
              console.log(
                `[tool_call] ${call.function.name} ${this.truncateJson(call.function.arguments ?? {})}`
              );
            }
            const result = await this.toolSystem.execute(
              call.function.name,
              call.function.arguments
            );
            if (this.logToolCalls()) {
              console.log(`[tool_result] ${call.function.name} -> ${this.truncateJson(result)}`);
            }
            await memory.add({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const stage = this.classifyToolErrorStage(error);
            return this.formatError({
              stage,
              tool: call.function.name,
              args: call.function.arguments ?? null,
              message: this.errorMessage(error),
            });
          }
        }

        continue;
      }

      // If we already have content from the first generate call, use it.
      // This avoids a redundant second LLM call and potential hanging.
      if (response.content) {
        onChunk(response.content);
        return response.content;
      }

      let finalText = "";
      try {
        for await (const chunk of this.engine.generateStream(
          this.providerName,
          memory.getSnapshot(),
          { model, tool_choice: "none" }
        )) {
          onChunk(chunk);
          finalText += chunk;
        }
        return finalText;
      } catch (error) {
        return this.formatError({
          stage: "LLM_REQUEST",
          message: this.errorMessage(error),
        });
      }
    }

    throw new Error("Max turns exceeded without final response.");
  }

  private async runWithPlan(task: string, model: string): Promise<string> {
    const plan = await this.createPlan(task, model);
    const results: Array<{ stepId: string; tool: string; result: unknown }> = [];

    for (const step of plan) {
      if (this.logToolCalls()) {
        console.log(`[tool_call] ${step.tool} ${this.truncateJson(step.args ?? {})}`);
      }
      const result = await this.toolSystem.execute(step.tool, step.args ?? {});
      results.push({ stepId: step.id, tool: step.tool, result });
      if (this.logToolCalls()) {
        console.log(`[tool_result] ${step.tool} -> ${this.truncateJson(result)}`);
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
      JSON.stringify(results),
    ].join("\n");

    const planningContext = process.env.PLANNING_CONTEXT ?? "true";
    process.env.PLANNING_CONTEXT = "false";
    try {
      return await this.run(summaryTask, model);
    } finally {
      process.env.PLANNING_CONTEXT = planningContext;
    }
  }

  private async runWithPlanStream(
    task: string,
    model: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const plan = await this.createPlan(task, model);
    const results: Array<{ stepId: string; tool: string; result: unknown }> = [];

    for (const step of plan) {
      if (this.logToolCalls()) {
        console.log(`[tool_call] ${step.tool} ${this.truncateJson(step.args ?? {})}`);
      }
      const result = await this.toolSystem.execute(step.tool, step.args ?? {});
      results.push({ stepId: step.id, tool: step.tool, result });
      if (this.logToolCalls()) {
        console.log(`[tool_result] ${step.tool} -> ${this.truncateJson(result)}`);
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
      JSON.stringify(results),
    ].join("\n");

    const planningContext = process.env.PLANNING_CONTEXT ?? "true";
    process.env.PLANNING_CONTEXT = "false";
    try {
      return await this.runStream(summaryTask, model, onChunk);
    } finally {
      process.env.PLANNING_CONTEXT = planningContext;
    }
  }

  private async createPlan(task: string, model: string): Promise<PlanStep[]> {
    const planner = new Planner(
      this.engine,
      this.providerName,
      this.toolSystem.listDefinitions().map((tool) => tool.name)
    );
    return planner.plan(task, model);
  }

  private formatError(payload: {
    stage: "LLM_REQUEST" | "TOOL_CALL" | "TOOL_EXECUTE";
    tool?: string;
    args?: string | Record<string, unknown> | null;
    message: string;
  }): string {
    const argsText = payload.args === undefined ? undefined : this.safeSerialize(payload.args);
    const parts = [
      "[error]",
      `stage=${payload.stage}`,
      payload.tool ? `tool=${payload.tool}` : undefined,
      argsText ? `args=${argsText}` : undefined,
      `message=${this.safeSerialize(payload.message)}`,
    ].filter(Boolean);
    return parts.join(" ");
  }

  private safeSerialize(value: unknown): string {
    try {
      if (typeof value === "string") {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return JSON.stringify(value);
    } catch {
      return "\"[unserializable]\"";
    }
  }

  private classifyToolErrorStage(error: unknown): "TOOL_CALL" | "TOOL_EXECUTE" {
    const message = this.errorMessage(error);
    if (
      message.includes("Invalid JSON arguments") ||
      message.includes("argument validation failed")
    ) {
      return "TOOL_CALL";
    }
    return "TOOL_EXECUTE";
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private async loadSystemPrompt(): Promise<string> {
    const defaultPrompt =
      "You are a helpful assistant. Use tools when needed and return final answer to the user.";
    const promptPath = path.resolve(process.cwd(), "prompts", "system.md");
    try {
      const content = await readFile(promptPath, "utf-8");
      return content.trim();
    } catch {
      return defaultPrompt;
    }
  }

  private async loadDeveloperPrompt(): Promise<string> {
    const promptPath = path.resolve(process.cwd(), "prompts", "developer.md");
    try {
      const content = await readFile(promptPath, "utf-8");
      return content.trim();
    } catch {
      return "";
    }
  }

  private maxMemoryItems(): number {
    const raw = process.env.MEMORY_MAX_ITEMS;
    if (!raw) {
      return 40;
    }
    const value = Number(raw);
    if (Number.isNaN(value) || value <= 0) {
      return 40;
    }
    return value;
  }

  private async maybeRetrieve(task: string): Promise<string | null> {
    if (!this.shouldRetrieve(task)) {
      return null;
    }
    const store = new VectorStore({ provider: this.resolveEmbeddingProvider() });
    await store.load();
    const results = await store.search(task, 3);
    if (results.length === 0) {
      return null;
    }
    return results.map((item) => `- ${item.text}`).join("\n");
  }

  private shouldRetrieve(task: string): boolean {
    const keywords = [
      "previous",
      "earlier",
      "last time",
      "history",
      "remember",
      "prior",
      "before",
      "之前",
      "上次",
      "历史",
      "记住",
    ];
    const lower = task.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  }

  private resolveEmbeddingProvider() {
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

  private logToolCalls(): boolean {
    return (process.env.LOG_TOOL_CALLS ?? "false").toLowerCase() === "true";
  }

  private planningMode(): "off" | "on" | "auto" {
    const mode = (process.env.PLANNING_MODE ?? "off").toLowerCase();
    if (mode === "on" || mode === "auto") {
      return mode;
    }
    return "off";
  }

  private shouldPlan(task: string, mode: "on" | "auto"): boolean {
    if (mode === "on") {
      return true;
    }
    const keywords = ["plan", "steps", "fix", "refactor", "test", "analyze", "compile", "build"];
    return task.length > 120 || keywords.some((keyword) => task.toLowerCase().includes(keyword));
  }

  private truncateJson(value: unknown, maxLength = 400): string {
    const text = this.safeSerialize(value);
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }
}
