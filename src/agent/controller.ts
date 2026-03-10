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
      const response = await this.engine.generate(this.providerName, messages, {
        model,
        tools: this.toolSystem.listDefinitions(),
        tool_choice: "auto",
      });

      if (response.tool_calls && response.tool_calls.length > 0) {
        messages.push({
          role: "assistant",
          content: response.content ?? "",
          tool_calls: response.tool_calls,
        });

        for (const call of response.tool_calls) {
          const result = await this.toolSystem.execute(call.function.name, call.function.arguments);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }

        continue;
      }

      return response.content ?? "";
    }

    throw new Error("Max turns exceeded without final response.");
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
