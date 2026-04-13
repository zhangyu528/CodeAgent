# Session Message Windowing

## Problem Statement

`SessionManager.loadSession()` loads the complete message history from disk into memory without any bounds check. A session with 5,000+ messages (plausible in long coding sessions) would consume significant memory and slow down message processing. The CLAUDE.md claims "~4000 tokens" memory management, but no such sliding window actually exists in `sessions.ts` — all messages are returned unconditionally.

## Recommended Direction

**Tiered Session Loading with Configurable Message Window**

Introduce a `SessionWindow` abstraction that returns a sliding window of messages based on token count, with a new `loadSessionWindow(id, maxTokens)` method alongside the existing `loadSession(id)`:

```typescript
interface SessionWindow {
  messages: AgentMessage[];
  totalTokens: number;
  totalMessages: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

function loadSessionWindow(
  sessionId: string,
  options: { maxTokens?: number; maxMessages?: number; anchor?: 'latest' | 'around' }
): Promise<SessionWindow>;
```

**Token counting** uses a simple heuristic (avoids adding a tokenization dependency):
```typescript
function estimateTokens(messages: AgentMessage[]): number {
  // Rough estimate: ~4 chars per token for mixed content
  return messages.reduce((sum, m) => sum + (m.content?.length ?? 0) / 4, 0);
}
```

**Sliding window behavior:**
- `anchor: 'latest'` — return most recent messages up to `maxTokens`
- `anchor: 'around'` — center window around middle of session for full-context reads
- Pagination markers (`hasMoreBefore/After`) signal to the agent if context is truncated

## Key Assumptions to Validate

- [ ] `AgentMessage.content` is the primary token source — no need to tokenize role/system preamble
- [ ] 4000 token default is the right default (aligns with existing CLAUDE.md claim)
- [ ] `bun:sqlite` sessions are out of scope (N4 / session-storage-abstraction handles that)

## MVP Scope

1. Add `estimateTokens()` utility in `sessions.ts`
2. Add `loadSessionWindow()` method to `SessionManager`
3. Update `sessionManager.loadSession()` to call `loadSessionWindow()` by default (backward compatible — existing callers get the full session)
4. Add tests for token estimation and window boundary cases
5. Wire the window into the agent's message pipeline (in `pi-agent-core` integration layer)

## Not Doing (and Why)

- **Hard session size limit** (rejecting sessions over N messages) — better to window than reject; a separate `MAX_MESSAGES` cap can be added later
- **Real tokenization** — adds a heavy dependency (e.g., `@anthropic/tokenizer`) for a rough estimate; revisit if estimates are significantly off
- **Disk-level pagination** — streaming large sessions from disk would require a format change; N4 (storage abstraction) can address this

## Open Questions

- Should the window size be configurable via environment variable?
- Does `pi-agent-core` have a hook for intercepting session load to inject windowing?
