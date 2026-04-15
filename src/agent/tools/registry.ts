/**
 * ToolRegistry — validates and manages ToolDefinition instances.
 * All CodeAgent tools must be registered through this class to ensure
 * schema compliance at startup.
 */
import { ToolDefinitionSchema } from './schema.js';
import type { ToolCategory, ToolDefinition } from './schema.js';

/**
 * Error thrown when tool registration fails validation.
 */
export class ToolValidationError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly zodError: string
  ) {
    super(`Invalid tool definition for "${toolName}": ${zodError}`);
    this.name = 'ToolValidationError';
  }
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  /**
   * Register a tool definition. Validates against ToolDefinitionSchema at registration time.
   * @throws ToolValidationError if the definition is invalid
   * @throws Error if a tool with the same name is already registered
   */
  register(def: ToolDefinition): void {
    const result = ToolDefinitionSchema.safeParse(def);
    if (!result.success) {
      throw new ToolValidationError(String(def.name), result.error.message);
    }

    if (this.tools.has(def.name)) {
      throw new Error(`Tool "${def.name}" is already registered`);
    }

    this.tools.set(def.name, def);
  }

  /**
   * Retrieve a registered tool by name.
   * @returns the ToolDefinition, or undefined if not found
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools, optionally filtered by category.
   */
  list(category?: ToolCategory): ToolDefinition[] {
    const all = [...this.tools.values()];
    if (category) {
      return all.filter(t => t.category === category);
    }
    return all;
  }

  /**
   * Introspect the registry — returns all tools and unique categories.
   */
  introspect(): { tools: ToolDefinition[]; categories: string[] } {
    const tools = [...this.tools.values()];
    const categories = [...new Set(tools.map(t => t.category))];
    return { tools, categories };
  }
}
