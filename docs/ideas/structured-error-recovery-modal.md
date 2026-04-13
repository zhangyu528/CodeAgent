# Structured Error Recovery Modal

## Problem Statement

CodeAgent's tool execution failures currently display as raw text error messages with no structured recovery path. When `read_file` hits a path traversal, `run_command` gets blocked, or `search_files` hits a timeout, the user sees a wall of text — no context about *what* went wrong, *why* it happened, or *what they can do about it*. This is especially problematic in the Ink TUI where errors compete with the chat stream for attention.

The result: users either ignore errors entirely or manually re-trigger commands with corrected arguments — neither of which leverages the agent's ability to self-correct.

## Recommended Direction

Introduce a **Structured Error Taxonomy** + **Ink Error Modal with Recovery Actions**:

```
Error Types:
  TOOL_PERMISSION_DENIED   → "This path is outside your workspace"
  TOOL_PATH_NOT_FOUND      → "File/folder not found"
  TOOL_TIMEOUT             → "Operation timed out after N seconds"
  TOOL_BLOCKED             → "Command blocked for security reasons"
  TOOL_INVALID_INPUT       → "Invalid argument: <detail>"
  AGENT_CONTEXT_OVERFLOW   → "Context window full, need to summarize"
```

Ink Error Modal shows:
1. Error type badge (color-coded)
2. Short explanation of *why* it failed
3. Suggested recovery actions (buttons):
   - "Try different path" → re-invoke with new args
   - "Retry with longer timeout" → re-invoke with timeout param
   - "Ignore and continue" → skip this step
   - "Show full error" → expand raw error

The modal appears inline in the chat stream, doesn't disrupt the typing indicator, and closes automatically on resolution.

## Key Assumptions to Validate

- [ ] **Assumption 1**: Users actually want recovery options vs. just seeing the error
  → *How to test*: Survey 3-5 users on whether they prefer "fix options" or "just show me the error"
- [ ] **Assumption 2**: The Ink modal system can render inline without breaking the MessageList layout
  → *How to test*: Build a prototype ErrorModal that appears between message items in 30 minutes
- [ ] **Assumption 3**: Error recovery can be automated (agent retries with corrected args) vs. always requiring user confirmation
  → *How to test*: Analyze recent session transcripts for retry patterns

## MVP Scope

**What's in:**
- `src/apps/cli/ink/components/modals/ErrorRecoveryModal.tsx` — modal with error type, explanation, and 2-4 action buttons
- `src/agent/errors.ts` — `ErrorType` enum + `ToolError` interface with structured error taxonomy
- Each tool (`read_file`, `run_command`, etc.) returns structured `ToolError` instead of raw string on failure
- Modal renders in `MessageList` when a tool error is detected (no auto-dismiss — user chooses action)

**What's out:**
- Automatic agent self-correction (agent decides whether to retry based on error type) — save for v2
- Error history / session-level error analytics — save for N5 (session governance)
- Haptic/confirmation sounds — not relevant for TUI
- Error recovery for *all* tools at once — just read_file, run_command, write_file in v1

## Not Doing (and Why)

- **Full error taxonomy for all 6 tools in v1** — too much scope; focus on the 3 most failure-prone tools first
- **Agent auto-retry without confirmation** — autonomy vs. control tradeoff; let users decide in v1
- **Structured logging to session** — defer to N5 error analytics work

## Open Questions

- Should the modal offer "copy error to clipboard" for bug reports?
- Should error types be extensible by tool authors (plugin API)?
- Should we throttle repeated failures of the same command (e.g., 3x `read_file` failures = suggest "file may not exist")?
