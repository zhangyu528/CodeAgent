# Sandboxed Tool Execution

## Problem Statement
How might we make CodeAgent's tool execution (run_command, write_file, read_file) safe enough for autonomous operation without requiring constant user confirmation or restricting its power?

## Recommended Direction

**Workdir-Scoped Tool Sandbox with Permission Ledger**

CodeAgent currently has a critical structural security gap: its tools operate without any path or command restrictions (unless `RUN_COMMAND_UNSAFE` is disabled). This is fine for a power user who trusts the model, but it's a blocker for:
1. Wider distribution (enterprise, team use)
2. Autonomous/cron operation (like this very cron job)
3. Onboarding new users who don't want "rm -rf" surprises

The recommended direction is a **session-scoped permission ledger** with a whitelist of allowed operations, initialized per session based on the project root. This is the approach taken by Cursor, Replit Agent, and Claude Code — not a "no shell access" sandbox, but a "bounded shell access" sandbox.

**How it works:**
1. At session start, user (or config) defines the **workspace root** (default: `process.cwd()`)
2. All file operations are validated against workspace root (no `../` escapes)
3. Shell commands are categorized into tiers:
   - **Safe tier** (auto-approved): `ls`, `cat`, `grep`, `git status`, `bun test`
   - **Elevated tier** (confirm once per session): `git push`, `npm install`
   - **Dangerous tier** (always confirm): `rm -rf`, curl | bash, process.env mutations
4. A per-session **permission ledger** tracks what has been approved, allowing "remember for session" UX
5. `RUN_COMMAND_UNSAFE` is deprecated and replaced by `CODEAGENT_WORKSPACE_ROOT` + tier config

## Key Assumptions to Validate
- [ ] Users are primarily doing project-scoped work (not system admin tasks) — test by surveying usage patterns
- [ ] A regex-based command tier classifier can achieve <1% false positive rate — test with real session logs
- [ ] File path validation at the tool layer (not the agent layer) won't break MCP tools — audit tool registry
- [ ] Users accept "confirm once per session" UX — test with 5 users

## MVP Scope

**In:**
- `CODEAGENT_WORKSPACE_ROOT` env var sets the sandbox boundary
- `read_file` and `write_file` validate paths against workspace root
- `search_files` depth limit already exists — connect it to workspace root
- `run_command` command tier classifier (3 tiers, config-driven blocklist)
- Session permission ledger (in-memory, resets per session)
- Replace `RUN_COMMAND_UNSAFE` with `CODEAGENT_WORKSPACE_ROOT` docs

**Out:**
- Docker/VM sandboxing (too heavy for CLI tool)
- Network access restrictions (future)
- Audit logging to disk (N5 scope)
- Per-tool granular permissions UI (over-engineering for MVP)

## Not Doing (and Why)
- **Full process isolation (Docker)** — kills startup latency and defeats the "terminal native" positioning
- **LLM-based command classification** — too slow, too expensive, wrong layer
- **Permission UI in TUI** — modal confirmation already exists, extend it vs. redesign
- **Path ACLs per tool** — workspace root is 90% of the protection with 10% of the complexity

## Open Questions
- Should workspace root be per-session (dynamic) or per-install (static config)?
- How do we handle tools that legitimately need to read outside workspace (e.g., ~/.gitconfig)?
- Does pi-agent-core expose a hook for pre-tool validation, or do we wrap at the tool registration layer?
- What's the migration path for existing users who rely on RUN_COMMAND_UNSAFE?
