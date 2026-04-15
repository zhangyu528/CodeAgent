# Typed Tool Registry with Schema Validation

## Problem Statement

CodeAgent's tool system (`src/agent/tools/`) has no enforced standard for tool schema structure. Each tool defines its own ad-hoc Zod schema, description format, and parameter conventions. This creates:
1. **Inconsistent tool metadata** — no standard for descriptions, examples, or return type docs
2. **No validation pipeline** — schemas are defined but never validated against a shared contract
3. **Discovery friction** — the agent cannot introspect tool capabilities consistently because schemas lack uniform metadata
4. **Testing difficulty** — each tool must be tested individually with no shared test utilities

The existing `tools/index.ts` aggregates tools, but there's no `ToolDefinition` interface enforcing a shared shape, no centralized registry validation, and no documentation standard for what each field means.

## Recommended Direction

Introduce a **typed ToolRegistry** with a shared `ToolDefinition` interface (backed by Zod) that all tools must conform to. The registry validates all tools at startup and provides a uniform introspection API for the agent.

```typescript
// A shared ToolDefinition contract — all tools must implement this shape
export const ToolDefinitionSchema = z.object({
  name: z.string().describe('Unique tool identifier (snake_case)'),
  label: z.string().describe('Human-readable action label for UI'),
  description: z.string().describe('What the tool does, one paragraph max'),
  category: z.enum(['file', 'terminal', 'web', 'code', 'system']).describe('Tool classification'),
  parameters: z.instanceof(z.ZodType).describe('Zod schema for tool parameters'),
  examples: z.array(z.object({
    input: z.record(z.string, z.unknown()),
    description: z.string(),
  })).optional().describe('Usage examples for the agent'),
  deprecationReason: z.string().optional().describe('If set, tool is deprecated'),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// Registry validates all tools at startup
export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(def: ToolDefinition) {
    // Validate conforms to ToolDefinitionSchema
    const result = ToolDefinitionSchema.safeParse(def);
    if (!result.success) {
      throw new Error(`Invalid tool definition for "${def.name}": ${result.error.message}`);
    }
    this.tools.set(def.name, def);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(category?: string): ToolDefinition[] {
    // ...filter support
  }

  introspect(): ToolIntrospection {
    return {
      tools: [...this.tools.values()],
      categories: [...new Set([...this.tools.values()].map(t => t.category))],
    };
  }
}
```

## Key Assumptions to Validate

- [ ] The `pi-agent-core` tool interface can accommodate a stricter `ToolDefinition` shape without breaking existing tools
- [ ] The performance overhead of schema validation at startup is acceptable (< 50ms)
- [ ] Tool authors (developers adding new tools) will benefit from enforced standards vs. finding them burdensome

## MVP Scope

1. Define `ToolDefinitionSchema` in a new `src/agent/tools/schema.ts`
2. Refactor existing tools (`read_file`, `write_file`, `run_command`, `list_directory`, `search_files`) to conform
3. Create `ToolRegistry` class with startup validation
4. Replace `allTools` array in `tools/index.ts` with registry-based aggregation
5. Add unit tests for `ToolRegistry` (validation, list, introspect)
6. Add `examples` field to at least 2 tools (read_file, run_command) as demonstration

## Not Doing (and Why)

- **Adding tool categories beyond the MVP set** — defer until real usage data shows gaps
- **Tool deprecation system** — separate idea (see dependency-compatibility-guard.md already covers deprecation patterns)
- **Auto-generated tool documentation** — would need separate docs pipeline; hand-written examples are sufficient for MVP
- **Dynamic tool loading** (plugin system) — scope creep; static registration is fine for current team size

## Open Questions

1. Should `ToolDefinition.parameters` use `z.ZodType` (runtime) or a TypeScript-first type description for better IDE support?
2. Should tool examples be used by the agent at runtime for few-shot prompting, or just for documentation?
3. Does `pi-agent-core` have a tool definition interface we should align with rather than defining our own?
