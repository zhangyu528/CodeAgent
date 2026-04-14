# Conventional Commit Lint Enforcement

## Problem Statement

How might we ensure every commit message follows a consistent format without relying on developer discipline alone?

The CodeAgent project has 0% Conventional Commits adoption despite detailed, well-written commit messages. Manual convention-setting fails. Automation is the only reliable mechanism.

## Recommended Direction

Add a commit-msg hook (via Husky) + ESLint rule that:
1. Validates commit messages against Conventional Commits regex on every `git commit`
2. Fails the commit with a clear error if format is wrong
3. Provides a `--no-verify` escape hatch for legitimate edge cases (documented in commit message)

Use `@commitlint/config-conventional` with a custom rule set. Integrate with existing husky setup (already has pre-commit hook at `.husky/pre-commit`).

The key insight: make the right thing the easy thing. Developer writes `git commit -m "fix: correct typo in README"` — it passes automatically. Developer writes `git commit -m "fixed typo"` — they get a helpful error explaining the format.

## Key Assumptions to Validate

- [ ] Husky is already installed and functional (confirmed: `prepare` script runs husky install)
- [ ] CI pipeline can run commitlint on PRs to catch any bypassed local hooks
- [ ] Existing 202 commits won't be touched (history stays as-is; only new commits enforced)
- [ ] Team will accept the friction during adoption (1-2 weeks adjustment period)

## MVP Scope

**In:**
- `.husky/commit-msg` hook with `@commitlint/cli`
- `commitlint.config.js` extending `@commitlint/config-conventional`
- Documentation in CONTRIBUTING.md explaining the format
- CI job that runs `commitlint` on all PR commits

**Out:**
- Auto-fix mode (manual correction required — builds habit)
- Commit type whitelist customization beyond conventional types
- Migration of existing commit history

## Not Doing (and Why)

- **Commit message auto-fix**: Forces developers to learn the format. Auto-fix defeats the habit-forming purpose.
- **Rewriting history**: 202 commits are historic record. Future commits are the target.
- **Custom commit types**: Stick to standard 7 types. Adding custom types dilutes tooling.

## Open Questions

- Should `WIP` commits be allowed via `git commit --no-verify` or should we require `type: WIP - subject`?
- Should squash merges be auto-formatted or require explicit confirmation?
