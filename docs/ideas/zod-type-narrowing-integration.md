# Zod-Driven Type Narrowing for Zustand Stores

## Problem Statement

The project has 14 TypeScript compilation errors, all stemming from the same root cause: **Zustand stores and React components use plain TypeScript types that don't leverage Zod schema validation for type narrowing**.

Examples from the codebase:
- `chatStore.ts:232` — `ChatMessage | undefined` not assignable to `ChatMessage`
- `messageStore.ts:33` — same issue
- `useModelConfig.ts` — 3-argument function calls failing type checks
- `useProviderConfig.ts` — same pattern
- `ErrorBoundary.tsx` — `error` property doesn't exist on `ErrorInfo` type

The project already uses **Zod 4.3.6** for schema validation in `run_command.ts` and other tools, but Zustand stores and component props use plain TypeScript interfaces that lack runtime validation guarantees.

## Recommended Direction

Introduce a pattern where:
1. **Zustand store state** is defined via Zod schemas, not plain interfaces
2. **Type narrowing helpers** (`assert`, `infer`) derive TypeScript types from Zod schemas
3. **Store actions** use Zod schemas to validate state transitions at runtime
4. **Component props** use `z.infer<>` for prop types derived from schemas

This gives us **compile-time type safety + runtime validation** from a single source of truth.

## Key Assumptions to Validate

1. Zustand 5 supports Zod schema integration (verify via zustand docs)
2. The team is willing to adopt `z.infer<>` pattern for store types
3. Existing store migrations can be done incrementally without breaking changes

## MVP Scope

- Define `ChatMessageSchema` in `src/apps/cli/ink/store/schemas.ts`
- Narrow `chatStore.ts` state types using `z.infer<>`
- Fix the 2 TypeScript errors in `chatStore.ts:232` and `messageStore.ts:33`
- Add Zod validation in store `setState` actions
- No changes to data flow or component hierarchy

## Not Doing (and Why)

- **Full store refactoring** — too risky for MVP; do incrementally per store
- **Runtime validation UI** — out of scope; just ensure type safety
- **Changing session storage** — separate N4 task

## Open Questions

1. Should we use `z.object()` or branded types for state narrowing?
2. How to handle partial updates (e.g., `updateMessage` action) with Zod?
3. Do we want to add a CI check that `tsc --noEmit` passes?
