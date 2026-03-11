import type { LLMEngine } from "../llm/engine.js";
import type { Message } from "../types.js";

export interface PlanStep {
  id: string;
  action: string;
  tool: string;
  args?: Record<string, unknown>;
}

export class Planner {
  constructor(
    private engine: LLMEngine,
    private providerName: string,
    private allowedTools: string[]
  ) {}

  async plan(task: string, model: string): Promise<PlanStep[]> {
    const allowedList = this.allowedTools.join(", ");
    const messages: Message[] = [
      {
        role: "system",
        content:
          "You are a planner. Output a JSON array of steps with fields: id, action, tool, args. Return only JSON. For run_command, args.cmd is required and args.args should be an array of strings (do not put spaces in cmd). Use only these tools: " +
          allowedList +
          ".",
      },
      { role: "user", content: task },
    ];

    const response = await this.engine.generate(this.providerName, messages, {
      model,
      tool_choice: "none",
      temperature: 0,
    });

    return this.parsePlan(response.content ?? "");
  }

  private parsePlan(content: string): PlanStep[] {
    const trimmed = content.trim();
    const jsonText = this.extractJson(trimmed);
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      throw new Error("Planner output is not a JSON array.");
    }
    return parsed.map((step, index) => ({
      id: String(step.id ?? index + 1),
      action: String(step.action ?? ""),
      tool: String(step.tool ?? ""),
      args: (step.args ?? undefined) as Record<string, unknown> | undefined,
    })).map((step) => {
      if (!step.tool) {
        throw new Error("Planner step missing tool name.");
      }
      if (!this.allowedTools.includes(step.tool)) {
        throw new Error(`Planner step uses disallowed tool: ${step.tool}`);
      }
      if (step.tool === "run_command") {
        const cmd = step.args?.cmd;
        if (typeof cmd !== "string" || cmd.trim().length === 0) {
          throw new Error("Planner step for run_command missing required args.cmd.");
        }
      }
      return step;
    });
  }

  private extractJson(content: string): string {
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch?.[1]) {
      return fenceMatch[1].trim();
    }

    const arrayStart = content.indexOf("[");
    const arrayEnd = content.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      return content.slice(arrayStart, arrayEnd + 1).trim();
    }

    return content;
  }
}
