# Lazy Agent Tool Loading

## Problem Statement

How might we reduce CodeAgent's cold-start time by deferring non-critical tool initialization until first use?

## Recommended Direction

The current implementation eagerly loads all tools and their schemas at startup. `@mariozechner/pi-ai` ships a `models.generated.js` file of ~13,896 lines that is fully parsed on every `codeagent` invocation. This blocks the TUI from rendering until the entire module graph is resolved.

**Recommended approach:** Implement lazy dynamic import for tools not required for initial UI render. The agent core tool (required for all AI operations) stays eager; file tools, search tools, and web tools load on-demand when first invoked.

Implementation strategy:
1. Convert `src/agent/tools/index.ts` from eager `import *` to a deferred registry
2. Tool registration happens via `Promise` that resolves on first use
3. Add a startup splash/loading indicator while tools initialize
4. Maintain backward compatibility for synchronous `getTools()` calls by caching after first load

This is NOT about tree-shaking (pi-ai is a private package we can't tree-shake). It's about deferring the `import` until the user actually needs the tool.

## Key Assumptions to Validate

- [ ] Cold start time is measurably slow (>2s from `codeagent` to first prompt)
- [ ] `pi-ai` module initialization is the primary bottleneck (not Ink or React)
- [ ] Lazy loading won't break existing tool consumers that expect synchronous access
- [ ] The performance budget target is <3s cold start on typical hardware

**Validation method:** Add `console.time` markers in `src/apps/cli/index.tsx` before and after agent initialization. Run `bun run dev` and measure 5 cold starts.

## MVP Scope

**In:**
- Measure current cold start time with `console.time`
- Convert `src/agent/tools/index.ts` to use dynamic `import()` for non-core tools
- Add `isLoading` state to Ink TUI during tool initialization
- Verify existing tests still pass

**Out:**
- Refactoring pi-ai internals (we don't control that package)
- Changes to tool schemas or behavior
- Changes to how tools are registered with the agent

## Not Doing (and Why)

- **Eager preloading of "commonly used" tools** — we don't have data on which tools are actually commonly used; adding heuristics without data is over-engineering
- **Web worker isolation for tool loading** — adds complexity without addressing the primary bottleneck (module parse time, not execution time)
- **Service worker caching** — not applicable to CLI context
- **pi-ai lazy loading internally** — private package, can't modify

## Open Questions

- Is cold start time actually a user pain point, or is this premature optimization?
- Do users expect instant TUI render even before the agent is "ready"?
- Should we show a skeleton UI while tools load, or a loading spinner?
