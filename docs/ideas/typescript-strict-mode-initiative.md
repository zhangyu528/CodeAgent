# Strict TypeScript Initiative: Eliminate Any Types

## Problem Statement

CodeAgent has **40+ instances of `any` type** across the codebase, concentrated in three critical areas:
1. **Agent core** (`agent.ts`, `model.ts`, `sessions.ts`) — `allTools as any`, `resolve(): any`
2. **Tool layer** (`src/agent/tools/*.ts`) — every `catch (error: any)` bypasses TypeScript's type checking
3. **CLI hooks** (`useAgentEvents.ts`, `useModelConfig.ts`) — `as any[]` casts

Every `any` is a gap in the type system — the compiler stops checking, IDE autocomplete disappears, and refactoring risks increase silently. With React 19 and strict TypeScript 5.9, this is technical debt that compounds.

## Recommended Direction

Phase 1: Audit and categorize all `any` occurrences by severity and effort.
Phase 2: Replace catch clause `any` with `unknown` + proper narrowing.
Phase 3: Create typed interfaces for all agent/tool return types.
Phase 4: Enable `strict: true` in tsconfig.json as the final step.

## Key Assumptions to Validate

- `catch (error: unknown)` + `instanceof Error` narrowing is the preferred pattern for tool error handling
- Replacing `allTools as any` requires `ToolDefinition` interface from `typed-tool-registry-with-schema-validation` (already an existing idea)
- `strict: true` won't break existing tests — verify with `tsc --noEmit` first

## MVP Scope

1. Replace all `catch (error: any)` with `catch (error: unknown)` + `if (error instanceof Error)` pattern across 5 tool files
2. Replace `resolve(): any` in `model.ts` with proper `ModelInfo` return type
3. Add `tsconfig.strict.json` that extends base config with `strict: true` and verify build
4. **Not doing**: full `any` elimination across all files (too large for one PR) — focus on the tool layer first

## Not Doing (and Why)

- Adding `typescript-strict` linter rule — better to enable via tsconfig incrementally
- Rewriting all legacy store types — deferred to N4 session storage work
- Refactoring React hooks `as any` casts — different effort/priority

## Open Questions

- Should we introduce a shared `Result<T, E>` type for tool return values instead of throwing?
- Should `strict: true` be a migration (opt-in via tsconfig extends) or default for new files?