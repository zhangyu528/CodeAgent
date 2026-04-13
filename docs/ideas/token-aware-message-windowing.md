# Token-Aware Message Windowing

## Problem Statement

CodeAgent's CLAUDE.md claims a "~4000 tokens token-aware sliding window" for message history, but the implementation has **zero token tracking**. Messages grow unbounded in Zustand stores, degrading performance and memory usage. The existing `messageStore.ts` and `chatStore.ts` both do `[...state.messages, msg]` without any pruning. This directly impacts:

1. **Memory**: Long conversations accumulate all messages in RAM
2. **Performance**: `MessageList.tsx` runs `groupMessagesByDate` and `buildMessageSignature` over all messages on every change
3. **Cost**: LLM context includes full conversation history with no summarization
4. **Latency**: Large message arrays slow down store operations

## Recommended Direction

**Three-Tier Message Architecture with SQLite Offloading**

Implement a tiered memory system that keeps recent messages in Zustand (hot), older messages in SQLite (warm), and summarizes very old messages (cold).

```
Recent (≤50 msgs, ≤4000 tokens) → Zustand (hot, fast access)
Mid-age (50-500 msgs) → SQLite via SessionRepository (warm, on-demand load)
Old (>500 or summarized) → Compressed summary in SQLite (cold)
```

### Tier 1: Hot Store (Zustand)
- Keep last ~50 messages or last ~4000 tokens in `chatStore.messages`
- Implement actual token counting using a simple char-based estimator (or `@anthropic/tokenizer` if available)
- When approaching limit, flush oldest messages to SQLite **before** they leave hot store
- **Key invariant**: Hot store always reflects the current conversation window the LLM sees

### Tier 2: Warm Storage (SQLite)
- Append-only message log in SQLite via `SessionRepository`
- `chatStore` loads message windows on-demand (e.g., "load earlier messages" on scroll)
- No in-memory accumulation beyond hot store limit
- Session restore pulls from SQLite with hot window pre-loaded

### Tier 3: Cold Summarization (Future/N5 scope)
- When messages exceed age threshold (configurable), generate summary via LLM
- Store summary as "anchor" in message list, drop full text from SQLite
- Show "[Earlier conversation summarized]" in UI

## Key Assumptions to Validate
- [ ] The LLM call path actually receives all messages from `chatStore.messages` — verify `sessions.ts` `replaceMessages()` usage
- [ ] SQLite session persistence is the right warm storage (not file-based JSON) — N4 SessionRepository will answer this
- [ ] Token estimation accuracy is sufficient (char-based vs actual tokenizer) — char/4 is ~95% accurate for English
- [ ] Users expect auto-pruning vs manual control — survey or add a `/context` command

## MVP Scope

**In:**
- `TokenCounter` utility (char-based estimation, export `estimateTokens(text): number`)
- Token limit config in `chatStore` (`MAX_TOKENS: 4000`, `MAX_MESSAGES: 50`)
- `pruneMessages()` function that trims oldest messages when limit exceeded
- `chatStore.addMessage` calls `pruneMessages()` before appending
- `MAX_MESSAGES` constant (soft cap, always keep system prompt + last N)
- Tests: `TokenCounter` accuracy, pruning behavior at boundaries
- **Do NOT**: SQLite offloading (defer to N4 SessionRepository), summarization, UI changes

**Out:**
- SQLite integration (N4 scope)
- LLM-based summarization (N5 scope)
- User-facing `/context` command (future)
- Changes to `messageStore.ts` (legacy, marked for removal)

## Not Doing (and Why)
- **Full tokenization library**: char/4 is 95%+ accurate for CLI message sizes, avoids extra dep
- **Eager pruning on every add**: Prune lazily when approaching limit (≤10% headroom), avoids O(n) on every keystroke
- **SQLite now**: N4 is already specced for SessionRepository — don't duplicate work

## Open Questions
- Should the token window include the system prompt? Yes — it counts toward context.
- How to handle streaming deltas during pruning? Don't prune mid-stream; prune on `message_end` event.
- What about `/resume` restoring full history? Load from SQLite on demand, don't pre-load everything.
- Does this affect `useAgentEvents` subscription behavior? `messages` array reference changes less often (prune = new array), actually reduces re-renders.
