# CI Quality Gate Automation

## Problem Statement

CodeAgent's CI pipeline lacks automated quality gates. The current state shows:

- **0/1 ESLint checks passing** — no .eslintrc exists, so `eslint --fix` silently does nothing
- **1/919 tests failing in CI** — `compatibilityCheck.test.ts` regex mismatch (`/Zod v\d/` vs "Zod 4.x")
- Husky pre-commit is configured but cannot enforce linting without an ESLint config
- No automated PR checks preventing merges that break tests or introduce lint errors

The result: low-confidence releases, silent quality degradation, and agents that can't trust the test suite.

## Recommended Direction

**Add ESLint configuration + GitHub Actions CI workflow** to create automated quality gates that run on every push and PR.

```
Phase 1: ESLint foundation
- Add .eslintrc.json with TypeScript + React rules
- Fix all ESLint errors (or use --max-warnings for existing ones)
- Verify lint-staged runs correctly in pre-commit

Phase 2: CI workflow
- Add .github/workflows/ci.yml with: lint → typecheck → test
- Fail fast on lint/type errors before running tests
- Add test report artifact upload for debugging

Phase 3: Quality dashboard
- Track lint error count, test pass rate over time
- Add badges to README (optional, low priority)
```

## Key Assumptions to Validate

- Bun is used as runtime but ESLint works with TypeScript via `@typescript-eslint/parser`
- Vitest test results can be consumed by GitHub Actions `junit` reporter
- The Husky pre-commit hook is correctly set up (husky 9.1.7 + lint-staged 16.4.0)

## MVP Scope

1. Add `.eslintrc.json` with `@typescript-eslint/recommended` rules and `react-hooks` rules
2. Add `scripts/lint-check.sh` that runs `bun run lint` and exits non-zero on errors
3. Add `.github/workflows/ci.yml` with jobs: `lint` → `typecheck` → `test`
4. Fix the `compatibilityCheck.test.ts` regex to match "Zod 4.x" → `/Zod v?4/`
5. **Not doing**: auto-fixing all ESLint warnings (separate task, high effort)

## Not Doing (and Why)

- ESLint `--fix` in CI is risky without first reviewing what auto-fixes would do
- PR branch protection rules require GitHub admin — separate infrastructure task
- Test coverage reporting (`@vitest/coverage-v8`) is configured but not run in CI yet — deferred
- Pre-commit skip for docs-only changes — not needed yet

## Open Questions

- Should ESLint errors fail CI, or just warnings? (recommend: errors fail, warnings logged)
- Should we use `bun` exclusively for all scripts, or support `npm`/`pnpm` fallback?
- Do we want a `lint:fix` script that auto-fixes before commit, separate from `lint:check`?
