import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LLMEngine } from "../llm/engine.js";
import type { Message } from "../types.js";
import type { ToolSystem } from "../tools/tool-system.js";

export class AgentController {
  constructor(
    private engine: LLMEngine,
    private toolSystem: ToolSystem,
    private providerName: string
  ) {}

  async run(task: string, model: string): Promise<string> {
    const systemPrompt = await this.loadSystemPrompt();
    const developerPrompt = await this.loadDeveloperPrompt();
    const messages: Message[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "system",
        content: developerPrompt,
      },
      { role: "user", content: task },
    ];

    const maxTurns = 4;

    for (let turn = 0; turn < maxTurns; turn += 1) {
      let response;
      try {
        response = await this.engine.generate(this.providerName, messages, {
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
        messages.push({
          role: "assistant",
          content: response.content ?? "",
          tool_calls: response.tool_calls,
        });

        for (const call of response.tool_calls) {
          try {
            const result = await this.toolSystem.execute(
              call.function.name,
              call.function.arguments
            );
            messages.push({
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
}
