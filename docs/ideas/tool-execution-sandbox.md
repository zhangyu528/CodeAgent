# Tool Execution Sandbox

## Problem Statement

CodeAgent's tool execution layer has an architectural gap: `run_command` uses `exec()` with shell injection risk, `write_file` has workspace isolation, but there's no unified **tool execution context** that governs:
1. Resource limits (CPU time, memory, file system scope)
2. Execution isolation (per-tool permission boundaries)
3. Audit trail (what ran, when, with what inputs)

Currently, security is scattered: `run_command.ts` does regex blocking, `write_file.ts` validates paths, `search_files.ts` checks depth. Each tool reinvents its own sandboxing, creating inconsistent coverage and maintenance burden.

## Recommended Direction

Introduce a `ToolExecutionContext` class in `src/agent/tools/` that provides a **unified sandboxing API** all tools delegate through:

```typescript
// src/agent/tools/sandbox.ts
interface SandboxOptions {
  maxMemoryMB?: number;
  maxCpuMs?: number;
  allowedPaths?: string[];   // Whitelist of accessible paths
  blockedCommands?: string[];
  timeoutMs?: number;
}

class ToolExecutionContext {
  constructor(options: SandboxOptions);
  
  // All tools use these methods
  exec(command: string, args?: string[]): Promise<ExecResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  
  // Security helpers
  validatePath(path: string): boolean;  // Consistent across all tools
  checkCommandAllowed(cmd: string): boolean;
}
```

**Migration path for run_command:**
- Phase 1: Keep existing regex blocklist, add `shell: false` via `spawn()`
- Phase 2: Extract into `SandboxContext.exec()` with the unified API
- Phase 3: Add resource limits (cgroups or ulimit simulation)

## Key Assumptions to Validate

- [ ] Bun supports `child_process.spawn()` with `shell: false` on all target platforms (Linux/macOS/Windows)
- [ ] A unified SandboxContext won't add measurable latency to tool execution
- [ ] Workspace root validation logic can be shared without creating coupling between tools
- [ ] Migration can be done tool-by-tool without breaking the agent at any point

## MVP Scope

1. **`src/agent/tools/sandbox.ts`** — `ToolExecutionContext` class with:
   - `validatePath()` — extracted from write_file.ts, shared by all file tools
   - `checkCommandAllowed()` — extracted from run_command.ts, extended with `shell: false`
   - `exec()` — spawn-based execution with timeout and buffer limits
2. **Update `run_command.ts`** — delegate to `ToolExecutionContext.exec()` with shell=false
3. **Update `write_file.ts`** — delegate path validation to `ToolExecutionContext.validatePath()`
4. **Update `search_files.ts`** — use shared path validation
5. **Unit tests** for sandbox boundary conditions

**Out of scope for MVP:** cgroups, memory limits, audit logging, plugin API

## Not Doing (and Why)

- **Per-tool permission plugins**: Over-engineering for MVP. The current tool set is fixed (5 tools). Dynamic plugin loading is a separate feature (see `mcp-tool-registry.md` idea).
- **cgroups-based resource limiting**: Requires OS-level support and root access. Not portable for a CLI tool that users run in varied environments.
- **Audit logging to disk**: Adds complexity and potential security risk (audit log itself becomes a file to protect). In-memory audit for MVP, external log aggregation can be a future step.

## Open Questions

1. Should the sandbox be **per-session** or **global** (one context for all sessions)? Per-session aligns better with multi-user/workspace scenarios but adds memory overhead.
2. For Windows compatibility: `spawn()` with `shell: false` on Windows uses `cmd.exe /c`, which has different syntax from bash. Do we need Windows-specific command translation?
3. Should blockedCommands use an **allowlist** (only explicitly permitted commands) instead of the current blocklist approach? Allowlist is safer but more disruptive to migrate.
