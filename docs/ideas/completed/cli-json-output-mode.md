# CLI JSON Output Mode for Scriptable Pipelines

## Problem Statement

CodeAgent is designed as an interactive TUI application, but the CLI also needs to support **non-interactive, scriptable usage** — e.g., piping output to `jq`, spawning from scripts, or embedding in CI/CD pipelines. Currently, there is no way to run `codeagent` in a mode that outputs structured JSON instead of the Ink TUI rendering. This prevents:

1. Parsing agent responses programmatically (CI integrations, webhooks, automation scripts)
2. Piping structured output to external tools (`jq`, `awk`, other CLI utilities)
3. Embedding CodeAgent in shell scripts without expecting TTY interactivity
4. Running in headless/server environments where TUI rendering is unavailable

## Recommended Direction

Introduce a `--json` / `--output=json` CLI flag that suppresses the Ink TUI and instead emits newline-delimited JSON (NDJSON) to stdout. Each agent turn produces one JSON object:

```json
{"type": "response", "content": "...", "model": "MiniMax-M2.7", "tokens": 1234}
{"type": "tool_call", "tool": "read_file", "args": {"path": "..."}}
{"type": "tool_result", "tool": "read_file", "result": "..."}
{"type": "error", "message": "..."}
```

A companion `--quiet` flag suppresses all TUI rendering but keeps tool result output for maximum machine-parseability.

## Key Assumptions to Validate

- Ink's rendering is the bottleneck for non-TTY usage — replacing stdout write with NDJSON will not require refactoring the agent core
- NDJSON (newline-delimited JSON) is preferred over a single JSON array for streaming friendliness
- The `codeagent` binary already handles CLI argument parsing via `commander` or `cac` — adding a flag is a low-risk change
- Tool results need to be serialized (some contain binary data or large strings) — truncate or use base64 for non-string outputs
- Error messages should be machine-parseable with a `code` field (e.g., `{"type": "error", "code": "AUTH_FAILED", "message": "..."}`)

## MVP Scope

1. Add `--json` flag to the CLI entry point (`src/apps/cli/index.tsx` or `bin/`)
2. When `--json` is active: bypass Ink TUI rendering, write NDJSON lines to stdout
3. Tool calls and results serialized to JSON with `type` discriminator field
4. Agent responses serialized as `{"type": "response", "content": "..."}`
5. Errors serialized as `{"type": "error", "code": "...", "message": "..."}`
6. Stdin remains active for multi-turn conversations (--json can be combined with interactive stdin)
7. **Not doing**: stdout/stderr split (all output to stdout in JSON mode), progress rendering suppression, piping binary tool outputs

## Not Doing (and Why)

- **Full streaming SSE/websockets**: too large for MVP, CI use cases are single-request-response
- **Rich terminal output in JSON mode**: defeats the purpose, keep it pure machine-readable
- **JSON schema validation of tool outputs**: defer to N4 session storage work which introduces schema version

## Open Questions

- Should `--json` mode also write to a log file for human debugging alongside the machine output?
- Should we support `--output-format=json|ndjson|text` for future extensibility (e.g., CSV, XML)?
- How should multi-turn sessions in `--json` mode work — each invocation is a separate session, or does `--json --session=NAME` attach to an existing named session?
- Should `--json` mode disable all colors/Emoji in tool results, or preserve them as-is (they are valid JSON strings)?
