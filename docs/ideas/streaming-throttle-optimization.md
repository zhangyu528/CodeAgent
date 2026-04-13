# Streaming Throttle Optimization

## Problem Statement
CodeAgent's streaming UX causes severe UI jitter during LLM token streaming. The `useAgentEvents` hook fires store updates on every single token (`appendTextDelta`, `appendThinkingDelta`), potentially triggering hundreds of React re-renders per second. This makes the TUI feel unresponsive and causes visible flickering on terminal emulators.

## Recommended Direction

**Throttled Batched State Updates with Virtual DOM Reconciliation**

Introduce a throttling layer between the streaming callbacks and the Zustand store that batches token deltas and updates the store at a controlled rate (target: 150ms intervals).

### Core Mechanism
1. **Accumulation Buffer**: Each streaming delta (token, thinking) is buffered in a `useRef` accumulator
2. **Throttled Flush**: A `setInterval` at 150ms reads the buffer, computes the accumulated update, and fires a single store mutation
3. **Final Sync**: On stream completion (`onTurnSettled`), a forced flush ensures no tokens are left in the buffer

### Key Implementation Points
- Use `useRef` for buffer (not `useState`) to avoid render cycle contamination
- The `setInterval` approach over `useThrottle` hook because we need guaranteed periodic flush even when no new tokens arrive
- Buffer stores: `{ textDeltas: string[], thinkingDeltas: string[] }` not individual characters
- Text accumulation uses `string.concat()` or array join (not `+=` which creates new string objects)

## Key Assumptions to Validate
- [ ] 150ms throttle interval feels responsive enough for user feedback — validate with 3+ users
- [ ] `onTurnSettled` reliably fires after every streaming turn — add explicit test coverage
- [ ] Throttle doesn't cause tokens to be permanently lost if `onTurnSettled` fails to fire
- [ ] Terminal resize events won't be starved by the throttle interval

## MVP Scope

**In:**
- Throttled `appendTextDelta` and `appendThinkingDelta` in `useAgentEvents.ts`
- Buffer flush on stream completion (`onTurnSettled` hook)
- Unit test verifying buffer accumulation and flush behavior

**Out:**
- Visual smoothing / animation (separate feature)
- Configurable throttle interval (future enhancement)
- Thinking delta separate throttling (can use same throttle with different target store)

## Not Doing (and Why)
- **Separate throttle per message type**: Over-engineering; text and thinking both benefit from same throttle window
- **Adaptive throttle based on token velocity**: Too complex for MVP; 150ms is sufficient for all practical streaming speeds
- **Jank-free rendering via React.memo everywhere**: This is P2, not P0; throttle alone reduces jank significantly

## Open Questions
- Should the throttle interval be configurable via env var or store state?
- Do we need to show a "streaming..." indicator during the throttle window when no visible update occurs?
- How do we handle the case where the user sends a new message while streaming is still throttled (i.e., buffered tokens + new input)?
