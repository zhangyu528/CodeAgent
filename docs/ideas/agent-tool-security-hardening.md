# Agent Tool Security Hardening

## Problem Statement

The analysis identified three critical security vulnerabilities in CodeAgent's tool execution layer that are not addressed by any existing idea proposal:

1. **Shell command injection bypass** (`run_command.ts`): The blocklist regex approach can be bypassed via command chaining (`;`) and shell metacharacter injection. The existing `shell-execution-hardening.md` proposal is unimplemented.

2. **Session ID path traversal** (`sessions.ts`, `sessionRepository.ts`): No validation exists to reject session IDs containing `../` or other path traversal characters. A maliciously crafted session resume could escape `~/.codeagent/sessions/`.

3. **Unbounded resource consumption** (`search_files.ts`): `MAX_DEPTH` limits nesting but not total file count. A directory tree with 100,000+ files exhausts memory. The `getHistory` sorts all sessions before slicing.

These three issues are the highest-severity findings from the 2026-04-14 analysis and represent a unified attack surface: untrusted input (session IDs, search paths, shell commands) that isinsufficiently validated before use.

## Recommended Direction

**Unified Tool Boundary Validation Layer**

Implement a validation layer at the tool boundary that validates all external inputs before they reach handler logic. This is a cross-cutting concern that benefits all tools simultaneously.

### Phase 1: Shell Command Hardening (Critical)

Implement the approach described in `shell-execution-hardening.md` but as a concrete PR:
- Add `shell: false` to `exec()` options for non-metacharacter commands
- Expand allowlist to include `git`, `npm`, `bun`, `node`, `python`, `pip`, `cargo`, `go`
- Add a second validation pass after shell expansion
- Block `sudo`, `su`, `chmod 777`, `chown`, `dd`, and other privilege escalation patterns

### Phase 2: Session ID Validation (High)

Add a `isValidSessionId()` guard in both `sessions.ts` and `sessionRepository.ts`:
```typescript
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
if (!SESSION_ID_REGEX.test(id)) {
  throw new ToolError('INVALID_SESSION_ID', 'Session ID contains invalid characters');
}
```

### Phase 3: Resource Bounds (Medium)

Add hard limits to unbounded operations:
- `maxFiles: 5000` cap in `searchFilesTool`
- `limit` parameter required (no default-less unbounded reads) in `getHistory`
- Delta buffer size check in `useAgentEvents.ts`

## Key Assumptions to Validate

1. The shell-execution-hardening proposal in `docs/ideas/shell-execution-hardening.md` covers the right approach for Phase 1
2. Session IDs are user-controlled (via `/resume` command), validating them is necessary
3. The `searchFilesTool` is called by the agent autonomously — the agent could trigger unbounded searches

## MVP Scope

**This proposal is NOT a PR-ready implementation — it is a meta-issue that organizes three existing but unimplemented security fixes under one coherent umbrella.**

MVP = implement all three phases and verify:
- Shell commands in the allowlist execute correctly
- Shell metacharacter injection is blocked
- Invalid session IDs are rejected
- `searchFilesTool` aborts after 5000 files
- All existing tests pass

## Not Doing (and Why)

- **SQLite backend for sessions**: Covered by `session-storage-abstraction.md` (N4)
- **Rate limiting on tool calls**: Would require changes to the agent-core API; defer to future work
- **API key permission hardening** (`chmod 0600 .env`): Low severity, can be a separate PR
- **ReDoS protection for user regex**: Would require a timeout-based approach that may break legitimate long searches; defer

## Open Questions

1. Should the expanded shell allowlist be configurable via environment variable, or hardcoded?
2. Should session ID validation reject IDs shorter than some minimum length?
3. Should the 5000 file cap be configurable or fixed?
4. Is there a test harness for shell command injection testing, or should one be created?
