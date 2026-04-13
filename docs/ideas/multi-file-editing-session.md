# Multi File Editing Session

## Problem Statement

How Might We enable CodeAgent to make coordinated multi-file changes in a single session, so users get atomic refactors that span multiple files without manual coordination?

## Recommended Direction

CodeAgent currently excels at single-file operations — read, write, search. But real coding tasks are rarely isolated: renaming a function means updating its definition AND all call sites AND tests. Today users must manually coordinate these changes across multiple agent calls.

The recommended direction is a **Multi-File Editing Session** mode: the agent tracks all files modified within a session, can group related changes into an atomic "change set," and presents the user with a preview + confirmation before applying multi-file changes. This transforms CodeAgent from a powerful single-file tool into a genuine refactoring companion.

Phase 1 (MVP):
- Track dirty files in a session-scoped working set
- Detect when a user's request spans multiple files
- Present a change-set preview before applying
- Apply all changes atomically on user approval

## Key Assumptions to Validate

- [ ] **Assumption 1**: Users frequently make multi-file changes that they must coordinate across multiple /resume calls
  → How to test: Survey 5 power users about their workflow
- [ ] **Assumption 2**: Presenting a change-set preview before applying improves trust and reduces errors
  → How to test: A/B test multi-file preview vs. direct apply
- [ ] **Assumption 3**: The LLM can reliably detect which files belong to a coordinated change (vs. unrelated edits)
  → How to test: Run 20 test prompts spanning 2-5 files, measure accuracy

## MVP Scope

**In:**
- Dirty-file tracking in session store
- Multi-file change detection (heuristic: same /resume session, related by import graph)
- Change-set preview rendered as a diff summary
- Atomic apply on user approval (one confirmation for all files)

**Out:**
- Automated dependency analysis (import graph parsing) — defer to v2
- Cross-file rename propagation — defer to v2
- Auto-tagging of change sets with semantic labels — defer to v2

## Not Doing (and Why)

- **Automated import graph parsing** — adds complexity before we validate the core workflow; users can manually specify file groups
- **Background lint/prettier on dirty files** — adds latency to the apply step; run separately if needed
- **Undo stack for multi-file changes** — tracked as a separate feature; session-level undo is complex
- **Cross-file refactoring** (rename function across 10 files) — requires deep code analysis, too risky for v1

## Open Questions

- What's the right UX for grouping files into a change-set? Manual (`@files: file1.ts, file2.ts`) or automatic (import-graph heuristic)?
- Should the change-set preview show full diffs or just a summary (file list + line counts)?
- How should we handle conflicts (user edits a file while agent is preparing the change-set)?
