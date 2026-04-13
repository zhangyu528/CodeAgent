# Session Manager Test Hardening

## Problem Statement

The `SessionManager` in `src/agent/sessions.ts` has a critical regression gap: `getHistory()` filters files with `.endsWith('.json')` on the assumption that `fsp.readdir(SESSIONS_DIR, { withFileTypes: false })` returns `string[]`. However, the test mock returns `DirEnt[]` (the `withFileTypes: true` shape), causing `e.endsWith is not a function` at runtime. Three tests fail and the bug was not caught in development because the mock does not match the actual `fs` API contract.

## Recommended Direction

Introduce typed mock fixtures for `sessions.ts` that faithfully replicate the `fs`/`fsp` API contracts, and add snapshot-based tests for error paths that previously relied on imprecise mocks. This closes the regression gap for `getHistory()`, `saveSession()`, and any future methods on `SessionManager`.

## Key Assumptions to Validate

1. `fsp.readdir` with `withFileTypes: false` returns `string[]` — confirmed by Node.js fs docs
2. The actual sessions directory path (`SESSIONS_DIR`) is reachable in test environments
3. `SessionManager` is instantiated the same way in tests as in production code

## MVP Scope

- [ ] Replace `sessions.test.ts` loose mocks with typed fixtures matching `fs`/`fsp` API contracts
- [ ] Add `getHistory()` test with `withFileTypes: false` mock returning `string[]`
- [ ] Add error-path tests for `readSession()` file-not-found and JSON-parse-fail scenarios
- [ ] Add test for `saveSession()` when `SESSIONS_DIR` is not writable
- [ ] Verify all 919 tests pass after changes (green suite)

## Not Doing (and Why)

- **Session storage abstraction (N4)** — separate effort; this is test-only
- **SQLite-backed sessions** — out of scope; N4 covers this
- **In-memory session store for tests** — over-engineering; typed fixtures on the real fs contract is sufficient

## Open Questions

1. Should `SessionManager` inject `fs`/`fsp` as dependencies (constructor DI) to make testing easier, or keep the direct import?
2. Is there a desire to use a mocking library (e.g., `vi.mock` from Vitest) instead of manual fixture factories?
