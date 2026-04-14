# Token-Aware Session Hydration

## Problem Statement

**How might we** reduce CodeAgent's cold-start time while maintaining full session continuity, especially for users with large conversation histories?

Currently `SessionManager` loads entire session files on startup. For sessions with 10,000+ messages (the `MAX_MESSAGES` cap), this means reading and parsing multi-MB JSON files synchronously before the TUI renders. This blocks the CLI startup experience.

---

## Recommended Direction

Implement **lazy token-bounded hydration**: load only the messages that fit within the active context window (e.g., last 4,000 tokens) on session resume, leaving full history on disk until needed.

### Why This Works

1. **Cold-start becomes O(4K tokens) not O(all tokens)** — instant TTI regardless of session size
2. **Memory stays bounded** — never more than `MAX_TOKENS` in memory at once
3. **Full history preserved** — older messages survive on disk, retrieved on demand for context extension
4. **Existing `loadSessionWindow()` infrastructure** — `sessions.ts` already has `loadSessionWindow()` with token estimation. We extend it to be the primary load path.

### Key Design

```
SessionManager.loadSession(id)
  → reads meta.json only (fast, small)
  → estimates total tokens from meta
  → if within window: load full session
  → if exceeds window: load last N tokens via sliding window
  → on demand: "load more" expands window backward (lazy)

~/.codeagent/sessions/{id}/
  meta.json    ← title, model, timestamps, totalTokens, totalMessages
  messages.json ← full message array (append-only, occasional compaction)
  window.json  ← current active window cache (optional, invalidates on write)
```

---

## Key Assumptions to Validate

- [ ] **Assumption 1**: Most users have sessions < 10 messages — cold-start is already fast and this is premature optimization.
  *How to test*: Instrument `loadSession` to log message count distribution across 1 week of production sessions.
- [ ] **Assumption 2**: The token estimation heuristic (char/4) is accurate enough for window sizing.
  *How to test*: Compare against actual tokenizer output for a sample of 100 sessions.
- [ ] **Assumption 3**: Users rarely need messages outside the recent window.
  *How to test*: Track how often "load earlier messages" is triggered in practice.

---

## MVP Scope

**What's in:**
- `SessionManager.loadSession()` returns a windowed `SessionRecord` by default
- `SessionWindow` becomes the primary return type, with `fullHistory: AgentMessage[]` as a separate lazy-loaded field
- A new `expandWindow(sessionId, direction: 'before' | 'after')` method fetches more messages from disk
- Startup benchmark: session resume must complete in < 200ms for sessions up to 10,000 messages

**What's out:**
- Background pre-fetching of older messages
- Server-side / cloud session storage
- Session compaction / archival (future work)
- Multi-device sync

---

## Not Doing (and Why)

- **Streaming message loading from disk** — adds complexity without clear user benefit; disk I/O is already fast
- **SQLite / LevelDB replacement** — current JSON files are human-readable and debuggable; not a bottleneck
- **Server-side session storage** — out of scope for a CLI tool; local-first is correct
- **Session deduplication** — different problem; belongs in a separate "session governance" idea

---

## Open Questions

- Should we cache the window as a separate `window.json` to skip re-parsing the full file on repeated resumes?
- What's the right default window size — should it be model-aware (different context windows for different models)?
- How do we handle the case where the session file itself is corrupted? Current error handling silently returns null — should we offer recovery?
