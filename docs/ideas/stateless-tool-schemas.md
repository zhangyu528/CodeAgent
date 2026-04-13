# Stateless Tool Schema Registry

## Problem Statement

CodeAgent's tools are registered at agent startup time with static schemas, but the LLM needs dynamic, context-aware tool descriptions. Today, `read_file` always shows the same schema regardless of:
- The current workspace (showing workspace-specific paths)
- The user's current task context
- Whether certain tools are actually available in the current session

This creates a gap where the model sees stale or irrelevant tool documentation, leading to:
1. **Hallucinated tool calls** — model calls `web_search` when it was never enabled
2. **Generic responses** — tool descriptions don't reflect the actual configured workspace
3. **Token waste** — full schemas for disabled/unavailable tools still sent in context

## Recommended Direction

**Dynamic Schema Injection with Context Tags**

Introduce a schema builder that constructs tool definitions at call-time, not startup-time. Each tool schema is assembled with three layers:

1. **Base Schema** — static definition from `tools/registry.ts`
2. **Context Tags** — environment-specific tags injected at call time (`workspace: /project`, `provider: anthropic`, `tools_enabled: [read,write,search]`)
3. **Availability Gating** — schemas for disabled tools are wrapped in an availability check, not omitted entirely (preserves tool discovery without error)

### Core Mechanism

```
ToolRegistry.getTools(context) → ToolDefinition[]
  ├── Filter: skip tools with check_fn() = false
  ├── Enrich: inject context tags into description
  ├── Sort: put recently-used tools first
  └── Compress: merge similar tool descriptions (e.g., read_file variants)
```

### Key Implementation Points
- `tools/registry.ts` exports `getToolDefinitions(context: AgentContext)` instead of static array
- Context includes: `workspaceRoot`, `enabledTools`, `provider`, `sessionHistory`
- Tool descriptions gain dynamic `## Context` section appended at call time
- Recently-used tools get an `🔥` prefix to signal priority to the model

## Key Assumptions to Validate

- [ ] The LLM actually benefits from dynamic schema enrichment vs. static schemas
- [ ] Context tags don't bloat the context window beyond savings from filtered tools
- [ ] `check_fn()` availability is reliable enough to gate schemas on
- [ ] Token cost of sending all tool schemas vs. filtered subset (measure!)

## MVP Scope

**In:**
- `ToolRegistry.getTools(context)` callable at agent.run() time, not import time
- Context passed from `agent.ts` → `model_tools.ts` → `registry.ts`
- Dynamic description enrichment: workspace root, enabled tools list
- Filter disabled tools at schema level (not just handler level)
- Tests: context injection correctness, disabled tool filtering

**Out:**
- Token-cost-aware schema compression (future N5)
- Semantic tool ranking based on session history (future)
- Tool recommendation engine (future)
- Changes to tool handler implementations

## Not Doing (and Why)

- **Embedding-based tool ranking**: too complex for v1; static priority + recency is sufficient
- **Full schema compression**: defer to token measurement in N5 governance work
- **Dynamic tool discovery** (loading tools at runtime based on context): architectural change, not MVP scope

## Open Questions

- Should we send a "tool manifest" at session start listing all available tools, then send full schemas on demand?
- How do we handle tools whose availability changes mid-session (e.g., user enables `mcp` after startup)?
- Should disabled tools show a "not available" stub or be fully omitted from the schema list?
