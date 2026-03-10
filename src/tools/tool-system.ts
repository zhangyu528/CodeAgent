import { z } from "zod";
import type { JSONSchema, ToolDefinition } from "../types.js";

export interface Tool<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: T;
  jsonSchema: JSONSchema;
  execute(args: z.infer<T>): Promise<unknown>;
}

export class ToolSystem {
  private tools = new Map<string, Tool>();

  constructor(tools: Tool[] = []) {
    tools.forEach((tool) => this.register(tool));
  }

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  listDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.jsonSchema,
    }));
  }

  async execute(name: string, rawArgs: string): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    let parsed: unknown;
    try {
      parsed = rawArgs ? JSON.parse(rawArgs) : {};
    } catch (error) {
      throw new Error(`Invalid JSON arguments for tool ${name}: ${(error as Error).message}`);
    }

    const validated = tool.parameters.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Tool ${name} argument validation failed: ${validated.error.message}`);
    }

    return tool.execute(validated.data);
  }
}
