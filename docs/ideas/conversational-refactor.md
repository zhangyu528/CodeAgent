# Conversational Guided Refactoring

## Problem Statement

**How Might We** make large-scale refactoring accessible to developers who aren't experts in the specific code area, without requiring them to manually identify all affected files and understand every dependency first?

## Recommended Direction

CodeAgent already has strong single-file editing tools. What developers struggle with is **coordinated multi-file refactoring** — the kind where renaming a function means updating 12 call sites, or extracting a utility means finding all the places that should use it.

The idea: a `/refactor` slash command that works in three phases:
1. **Intent parsing** — the user says "extract this function into a shared utils module" and the agent identifies candidates
2. **Interactive confirmation** — the agent shows a diff preview and asks "include these 8 files?" with options to add/remove
3. **Validated execution** — after changes, run the project's test suite and show a pass/fail summary

This turns a scary "will this break everything?" operation into a low-risk, interactive workflow. The key insight is that the **TUI's modal system is perfect for step-by-step confirmations** — ConfirmModal and SelectOneModal already handle this pattern.

The MVP is intentionally narrow: one slash command, three phases, no auto-apply without confirmation.

## Key Assumptions to Validate

- [ ] **Assumption 1**: Developers actually want coordinated multi-file refactoring from a CLI, not just a "let me run sed across the repo" approach. Test by surveying 5 potential users.
- [ ] **Assumption 2**: The existing ink modal system can handle the confirmation flow without major rework. Validate by building a prototype modal in 30 minutes.
- [ ] **Assumption 3**: Test suite integration (`bun run test:run`) is a reliable enough signal to validate refactor correctness. If the project doesn't have tests, this breaks.

## MVP Scope

### In
- `/refactor` slash command with three sub-commands: `extract`, `rename`, `move`
- Intent parsing via LLM (same model already used by the agent)
- Diff preview rendered in a modal before any file is written
- Post-refactor test run with pass/fail reporting

### Out
- Automatic refactoring without confirmation
- Complex dependency analysis (LLM handles this heuristically)
- Undo/rollback (deferred to a future session)
- Refactoring suggestions without explicit `/refactor` invocation

## Not Doing (and Why)

- **Auto-apply without preview** — trust is earned, not assumed. A CLI that rewrites files without showing a diff first is a non-starter.
- **Full static analysis graph** — too much complexity for v1. The LLM's heuristic understanding is "good enough" for typical refactoring tasks.
- **IDE integration** — the TUI is the product. Extending to VS Code/Zed is a distraction at this stage.
- **Refactoring language server** — building a real language server is 10x the work and requires per-language implementations. Not the point.

## Open Questions

- How do we handle refactors that span generated files (e.g., auto-generated types)? Should we exclude them by default?
- What's the timeout strategy if the LLM picks the wrong files? Should there be a "confirm each file" mode for paranoid users?
- Do we need a dry-run mode that doesn't write anything but shows what would happen?
