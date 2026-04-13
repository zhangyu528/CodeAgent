# Secure Tool Sandbox

## Problem Statement

CodeAgent's tool layer has inconsistent security posture: `read_file` and `write_file` properly validate against workspace root, but `list_directory` and `search_files` have **no path traversal protection**. Additionally, `run_command` uses regex-based command blocking that can be bypassed via `RUN_COMMAND_UNSAFE=1` environment variable. This creates a false sense of security — some tools are protected while others are not.

## Recommended Direction

**Unified Security Middleware for All File/Command Tools**

Introduce a centralized path validation and command sanitization layer that all tools must pass through:

### Core Mechanism
1. **Workspace Root Enforcement**: All tools touching filesystem must accept a `workspaceRoot` parameter and validate paths before execution
2. **Path Traversal Detection**: Normalize paths with `path.resolve()` and verify the result starts with `workspaceRoot`
3. **Command Allowlist**: Replace regex-based blocking with explicit command allowlisting (only `git`, `npm`, `bun`, `node`, etc.)
4. **Remove RUN_COMMAND_UNSAFE Bypass**: The `RUN_COMMAND_UNSAFE=1` mechanism completely disables command security — remove it

### Key Implementation Points
- Create `src/agent/tools/security.ts` with shared validation functions
- `validatePath(path: string, workspaceRoot: string): string | null` — returns normalized path or null if outside workspace
- `validateCommand(cmd: string): boolean` — explicit allowlist check
- All file/command tools import from `security.ts` instead of implementing ad-hoc checks
- `RUN_COMMAND_UNSAFE` env var and related code paths removed

## Key Assumptions to Validate
- [ ] All file tools currently have inconsistent workspace validation
- [ ] Removing `RUN_COMMAND_UNSAFE` won't break existing user workflows
- [ ] Command allowlisting won't block legitimate developer workflows

## MVP Scope

**In:**
- `src/agent/tools/security.ts` — shared validation middleware
- Patch `list_directory.ts` to use path validation
- Patch `search_files.ts` to use path validation  
- Patch `run_command.ts` to use command allowlist + remove RUN_COMMAND_UNSAFE
- Unit tests for security.ts validation functions

**Out:**
- New tool architecture (future refactor)
- IPC/bus-style tool communication
- Non-Unix command support

## Not Doing (and Why)
- **Complete tool rewrite** — this is middleware, not architecture change
- **Embedding-based anomaly detection** — overkill; explicit allowlist + path validation handles 99% of cases
- **Process-level sandboxing** — would require significant infrastructure changes

## Open Questions
- Should workspace root be configurable per-session or global?
- Do users legitimately need to escape the workspace for certain operations (e.g., `npm install` outside project)?
- Should we log all blocked operations for audit purposes?
