# MCP Tool Registry — Dynamic Tool Discovery & Composition

## Problem Statement

**How Might We** enable CodeAgent to dynamically discover, register, and compose tools at runtime — so users can extend the agent's capabilities without modifying core code?

## Recommended Direction

Build a **MCP (Model Context Protocol) Tool Registry** that allows CodeAgent to:
1. Discover tools from external MCP servers at startup
2. Register dynamically discovered tools into the agent's toolset
3. Compose multi-step tool workflows via declarative YAML/JSON schemas
4. Expose a `/tools` slash command for browsing available tools

**Why this matters for CodeAgent:**
- Current tools are compile-time registered (`src/agent/tools/index.ts`)
- Adding a new tool requires code changes + reinstall
- MCP protocol is becoming a standard for AI tool interop (Claude Desktop, Cursor, etc.)
- A tool registry enables **ecosystem growth** without core churn

**Reference:** MCP protocol spec → https://modelcontextprotocol.io

## Key Assumptions to Validate

- [ ] **Assumption 1:** The `@mariozechner/pi-agent-core` agent supports dynamic tool registration post-initialization
  - *How to test:* Check if `agent.setTools()` can be called multiple times or if there's an `addTool()` API
- [ ] **Assumption 2:** Users want to add custom tools without touching src/
  - *How to test:* Survey 3 power users on their extension patterns
- [ ] **Assumption 3:** MCP server discovery (stdio vs HTTP) fits the CLI deployment model
  - *How to test:* Prototype local MCP server discovery via `npx` / local PATH

## MVP Scope

**What's in:**
- `src/agent/tools/mcpRegistry.ts` — reads `~/.codeagent/mcp-servers.json` at startup
- MCP server child process management (stdio transport)
- Tool schema translation (MCP JSON → pi-agent-core tool schema)
- Dynamic registration into agent toolset
- `/tools` slash command showing discovered tools
- Configuration schema in `docs/mcp-registry.md`

**What's out:**
- HTTP-based MCP servers (v1 scope: stdio only)
- Tool composition / workflow chaining
- Remote MCP server discovery
- MCP server management UI

## Not Doing (and Why)

- **HTTP MCP transport** — requires auth + network security review for v1
- **Tool versioning** — out of scope; add after registry is stable
- **Tool marketplace** — separate project; not core responsibility
- **Automatic MCP server installation via npm** — security risks with arbitrary code execution

## Open Questions

1. Does `@mariozechner/pi-agent-core` expose a public API for dynamic tool registration?
2. Should MCP tools be isolated from built-in tools (different approval requirements)?
3. How should conflicting tool names be resolved (built-in vs MCP)?
4. What's the minimal MCP server manifest schema (`mcp-servers.json`)?
