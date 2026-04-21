# Shell Execution Hardening

## Problem Statement

CodeAgent's `run_command.ts` uses Node.js `exec()` to run shell commands. The current implementation relies entirely on a blocklist-first regex approach to prevent dangerous operations, but does not set `shell: false` in the exec options. This means:

1. **Shell injection surface**: Without `shell: false`, Node.js delegates to `/bin/sh -c "command"`, which processes shell features (variable expansion, command substitution, globbing) even if the blocklist catches the obvious dangers
2. **Allowlist too restrictive**: Only 15 commands are allowlisted (echo, cat, head, tail, grep, wc, ls, pwd, true, false, printf, touch, mkdir, cd, export, exit). Developer workflows need `git`, `npm`, `bun`, `node`, `python` — commands the blocklist currently permits but the allowlist blocks
3. **No defense in depth**: A single regex failure could bypass the blocklist; a second layer (shell isolation) is missing

## Recommended Direction

**Layered Shell Execution Security**

### Layer 1: Shell Isolation (`shell: false`)

Pass `{ shell: false }` to `exec()`. This disables shell interpretation entirely — no `$()`, backticks, pipes, or variable expansion. Commands run as direct process argv arrays.

**Trade-off**: This breaks commands that rely on shell features (e.g., `ls *.ts` glob expansion, `echo $PATH`). These must be handled differently:

- Glob patterns → use Node.js `fs.glob` or pre-expand before exec
- Environment variables → pass via `env` option to exec
- Pipelines → implement client-side by running commands sequentially and piping output manually

### Layer 2: Expanded Allowlist with Safe Aliases

Expand the allowlist to include common developer commands:

```
ALLOWED_COMMANDS = {
  # Read-only filesystem
  'ls', 'pwd', 'cat', 'head', 'tail', 'grep', 'wc', 'find', 'stat', 'diff',
  # File operations (non-recursive)
  'touch', 'mkdir', 'cp', 'mv', 'rm',
  # Shell builtins
  'echo', 'printf', 'true', 'false', 'exit', 'export', 'cd', 'type',
  # Version control
  'git', 'hg',
  # Package managers
  'npm', 'bun', 'pnpm', 'yarn',
  # Runtime
  'node', 'python', 'python3', 'ruby', 'go', 'cargo', 'rustc',
  # Build tools
  'make', 'cmake', 'gcc', 'g++',
  # Utilities
  'curl', 'wget', 'tar', 'gzip', 'gunzip', 'zip', 'unzip', 'chmod', 'chown',
}
```

Each allowlisted command gets a max timeout (short for destructive ops, longer for npm/bun installs).

### Layer 3: Path Restrictions (already implemented)

Keep existing workspace root restriction — no `cd /` or absolute paths outside workspace.

## Key Assumptions to Validate

1. Most developer commands in the allowlist are actually needed in practice
2. `shell: false` doesn't break critical workflows (needs testing)
3. Node.js `fs.glob` can replace shell glob expansion for `ls *.ts` patterns

## MVP Scope

1. Add `shell: false` to `exec()` options
2. Add glob pre-expansion for `ls`, `cp`, `rm` commands
3. Expand allowlist to include `git`, `npm`, `bun`, `node`
4. Add per-command timeout configuration
5. Update unit tests for new behavior

## Not Doing (and Why)

- **Docker containerized execution**: Overkill for most users; adds complexity and startup latency
- **eBPF sandbox**: Kernel-level, too platform-specific
- **Full shell emulation**: Too complex; maintain blocklist + allowlist instead

## Open Questions

1. Should `cd` change the working directory for subsequent commands in the same session? (Currently `cd` is a no-op in exec)
2. Should we implement command timeout per-allowlist-entry (e.g., `npm install` gets 120s, `git push` gets 30s)?
3. How to handle interactive commands (`vim`, `less`) that require a TTY?
