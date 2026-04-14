# Streaming Response Controls

## Problem Statement

CodeAgent streams LLM responses token-by-token as they arrive, providing real-time feedback. However, once a response begins streaming, **the user has zero ability to control it**: no way to cancel, pause, or throttle the output. This creates friction in several scenarios:

1. **Accidental trigger** — User sends a prompt, realizes it's wrong, but must wait for the full response to finish
2. **Excessive verbosity** — Model starts generating verbose explanations the user doesn't need
3. **Stuck in loops** — Agent enters a repetitive pattern but the user can't interrupt
4. **Context overflow risk** — Continuing a streaming response that will exceed context limits

Current UX: Ctrl+C kills the entire CLI process (SIGINT), losing session state entirely. There is no graceful stream interruption.

## Recommended Direction

Add **streaming response controls** at the TUI layer — keyboard shortcuts and UI affordances that let users cancel, pause/resume, and adjust the streaming speed of LLM responses without disrupting the session state.

### Key Design

```
Keyboard shortcuts during streaming:
  Ctrl+C       → Graceful cancel (stop stream, keep session intact)
  Ctrl+Z       → Pause/resume stream output
  Ctrl+↑/↓    → Adjust streaming speed (throttle)

UI during streaming:
  ┌─ Assistant ─────────────────────────────────┐
  │ ▋ streaming (Ctrl+C to cancel)               │ ← Status indicator
  │ The model is generating a response...         │
  └───────────────────────────────────────────────┘
```

### Graceful Cancellation

When user presses Ctrl+C during streaming:
1. Abort the in-flight HTTP request (via `AbortController`)
2. Mark the partial message with `status: 'cancelled'`
3. Preserve all prior messages in session
4. Allow user to resume from a clean state

### Session Integrity

Cancellation must NOT:
- Lose the current session ID
- Drop the conversation history
- Corrupt the session JSON file

Cancellation MUST:
- Save partial message if useful (show `[Cancelled after N tokens]`)
- Return user to input-ready state immediately

## Key Assumptions to Validate

- [ ] **Assumption 1**: `pi-agent-core` exposes an `abort()` or cancellation mechanism on the agent
  - *How to test*: Check if `agent.abort()`, `signal`, or cancellation token exists
- [ ] **Assumption 2**: Users actually want to cancel streams in practice
  - *How to test*: Survey 3-5 users, or instrument the CLI to log "stream cancel" events
- [ ] **Assumption 3**: SIGINT (Ctrl+C) can be intercepted in Ink without killing the process
  - *How to test*: Ink handles stdin; need to verify raw mode vs. cooked mode behavior

## MVP Scope

**In:**
- `useStreamingControls` hook: manages `isStreaming`, `isPaused`, `abortSignal`
- `handleCancel()`: graceful abort preserving session state
- `handlePauseResume()`: toggle stream output without aborting
- Keyboard listener in `pi_app.tsx` that intercepts Ctrl+C during active streaming
- Status indicator in chat header showing `streaming • Ctrl+C to cancel`
- Partial message preservation with `status: 'cancelled'`

**Out:**
- Speed throttling (Ctrl+↑/↓) — defer to `streaming-throttle-optimization` idea
- Pause with intent to resume (full pause/resume of HTTP stream) — complex, deferred
- Auto-cancel on context overflow — separate idea
- UI modal for cancellation confirmation — too heavy for CLI

## Not Doing (and Why)

- **Speed throttling** — belongs in `streaming-throttle-optimization`; keep this idea focused on cancel/pause
- **Full stream pause/resume** — technically complex (HTTP stream buffering), user need is lower than cancel
- **Modal confirmation on cancel** — adds friction; CLI users expect immediate feedback
- **Auto-cancel on context overflow** — risk of premature intervention; separate risk-based idea

## Open Questions

1. What does the partial message look like when cancelled — show the truncated output with `[cancelled]` marker, or discard entirely?
2. Should cancelled messages be saved to session history, or only shown as ephemeral preview?
3. How does cancellation interact with tool calls that were already started before the cancel signal?
4. Is there a difference between "cancel this turn" and "abort entire agent" — should Ctrl+C be two-stage (first press = cancel turn, second press = abort)?
