# Typed Command Allowlist for Safe Shell Execution

## Problem Statement

The `run_command.ts` tool uses a defense-in-depth approach with blocklist + allowlist + shell metachar detection. However, when a command is NOT in the `ALLOWED_REGEX` map AND has no shell metacharacters, it falls through to `exec()` with `shell=true` (line 164-187). This creates an implicit "unknown commands are allowed" policy that bypasses the allowlist's intent — new commands are permitted until explicitly blocked.

## Recommended Direction

Replace the implicit fallback with an **explicit typed allowlist** that enumerates known-safe commands with their expected argument signatures. Unknown commands trigger a `COMMAND_NOT_ALLOWED` error rather than falling through to shell execution.

```
Decision tree:
  1. Is command in ALLOWED_COMMANDS?
     → YES: validate args against schema, execute with execFile
  2. Does command contain shell metacharacters?
     → YES: reject with SHELL_METACHAR_BLOCKED
  3. Is command in BLOCKED_COMMANDS?
     → YES: reject with COMMAND_BLOCKED
  4. ELSE: reject with COMMAND_NOT_ALLOWED (no silent fallback)
```

Each allowed command gets a Zod schema for argument validation:

```typescript
const ALLOWED_COMMANDS = {
  git: { args: z.object({ cmd: z.string(), cwd: z.string().optional() }) },
  npm: { args: z.object({ command: z.enum(['install', 'run', 'test', ...]) }) },
  // ...
} as const;
```

## Key Assumptions to Validate

- [ ] No legitimate workflow requires running arbitrary unknown commands — all valid commands can be enumerated
- [ ] Users who need new commands will add them to the allowlist (vs. disabling the tool entirely)
- [ ] execFile without shell=true is sufficient for all allowed commands (no pipe/redirection needed in-tool)
- [ ] Argument schemas can be maintained as a flat map without becoming a maintenance burden

## MVP Scope

1. Define `COMMAND_ALLOWLIST` constant in `run_command.ts` with currently allowed commands + Zod schemas
2. Remove the implicit `exec()` fallback for unknown commands (line 164-187)
3. Add `COMMAND_NOT_ALLOWED` error type with helpful message listing how to request additions
4. Keep BLOCKED_COMMANDS for explicitly dangerous commands (rm -rf /, mkfs, etc.)
5. Update tests to cover the new rejection path for unknown commands
6. Add documentation comment explaining the security model

## Not Doing (and Why)

- **Dynamic allowlist from config file**: MVP uses hardcoded map. File-based config is N+1 territory.
- **Argument sandboxing (ptrace/seccomp)**: Too heavy for MVP. Zod schema validation catches malformed args.
- **Shell expansion in allowed commands**: If a command legitimately needs pipes, it should use a dedicated tool (e.g., `shell_eval`) rather than run_command.
- **Auto-discovery of safe commands**: Don't try to be clever. Explicit enumeration is the security boundary.

## Open Questions

- Should `bun` be added to the allowlist (since the project uses Bun as runtime)?
- Should we maintain separate allowlists for dev vs production environments?
- How to handle version-gated commands (git, npm have different features across versions)?
- Should unknown commands with shell=false (no metacharacters) ever be allowed through execFile, or should all execution go through the explicit allowlist?
