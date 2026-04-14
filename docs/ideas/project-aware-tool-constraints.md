# Project-Aware Tool Constraints

## Problem Statement

CodeAgent operates in any project directory but has no mechanism to understand project-specific constraints. When a user works in a monorepo, they may want the agent to refuse `rm -rf node_modules` even with approval. In a Docker-heavy project, `docker` commands may be preferred over `npm`. In a security-sensitive repo, certain shell commands may be outright forbidden regardless of user approval.

Currently, these constraints must be re-explained every session or embedded in a custom system prompt — neither is maintainable. There's no way to encode project-specific tool policies that the agent respects automatically.

## Recommended Direction

**A `.codeagentrc` dotfile at the project root** that encodes project-specific tool constraints. When the agent starts a session (or when `/new` is called), it reads `.codeagentrc` from the current working directory and merges the constraints into the tool execution policy.

```jsonc
// .codeagentrc — placed at project root
{
  "$schema": "https://codeagent.dev/codeagentrc-schema.json",
  "workspace": {
    // Restrict agent to subdirectory of project
    "root": "src/",
    // Additional allowed directories outside src/
    "extraAllowed": ["tests/", "scripts/", "docs/"]
  },
  "tools": {
    // Forbidden commands regardless of user approval
    "forbidden": ["rm -rf", "shutdown", "init 6"],
    // Commands requiring explicit approval even for non-destructive ops
    "requiresApproval": ["git push --force", "npm publish", "docker rmi"],
    // Tool preferences (agent favors these when multiple tools apply)
    "preferences": {
      "package manager": "pnpm",  // agent prefers pnpm over npm/yarn
      "test runner": "bun test"   // agent suggests bun test over npm test
    },
    // Disabled tools entirely for this project
    "disabled": ["browser_navigate"]
  },
  "model": {
    // Preferred model override for this project (optional)
    "provider": "minimax",
    "model": "MiniMax-M2.7"
  }
}
```

**Behavior:**
1. On session start, agent reads `.codeagentrc` from `process.cwd()`
2. `forbidden` commands raise an error before execution — no approval can override
3. `requiresApproval` lowers the approval threshold — dangerous ops always prompt
4. `preferences` are injected as soft hints to the model (not hard rules)
5. `disabled` tools are unregistered for the session

**Why `.codeagentrc` and not environment variables or a config file in `~/.codeagent/`?**
- Project-level: each project has its own constraints
- Version-controlled: committed alongside the project code
- Non-intrusive: doesn't require every user of the project to configure their own environment

## Key Assumptions to Validate

- [ ] `pi-agent-core` allows tool unregistration or adding tool filters at runtime
- [ ] The agent resolves `process.cwd()` correctly when started from a subdirectory (`codeagent src/utils/`)
- [ ] `.codeagentrc` should be optional — projects without it work unchanged
- [ ] `forbidden` should be a hard block with no override, not a warning

## MVP Scope

1. Define `.codeagentrc` JSON schema in `docs/codeagentrc-schema.md`
2. Add `loadProjectConstraints()` utility in `src/agent/constraints.ts`
3. Wire constraint loading into session startup (after `SessionManager.init`)
4. Implement `forbidden` command check in `run_command.ts` (before blocklist evaluation)
5. Add `disabled` tool filtering in the tool registry initialization
6. Document `.codeagentrc` in `docs/` with examples for common project types (monorepo, Docker project, security-sensitive repo)

## Not Doing (and Why)

- **Remote constraint fetching** (from a URL) — security risk; local file only
- **Constraint inheritance** (merging `.codeagentrc` from parent directories) — too complex for v1; single-file wins
- **Binary/output diffing for forbidden patterns** — `forbidden` is exact string match or regex; semantic analysis out of scope
- **UI for constraint editing** — dotfile is the UX; a future `/constraints` command could edit it

## Open Questions

1. Should `.codeagentrc` be committed to git by default? (Usually yes, but some projects may want it gitignored)
2. How to handle constraints when the agent operates on multiple projects in one session (e.g., `cd project-a && codeagent` then `cd ../project-b`)?
3. Should constraints be overridable at runtime via `/set-constraint` command, or are they immutable for the session?
4. What's the right schema validation story? (Zod parse at load time, with a clear error if malformed)
