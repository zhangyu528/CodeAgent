# Agentic Codebase Awareness

## Problem Statement

**How Might We** give CodeAgent persistent, queryable understanding of the codebase it operates in, so it doesn't start each session blind and repeatedly waste context tokens re-analyzing the same files?

## Recommended Direction

CodeAgent's core loop is: read → think → act → read → think → act. But every session starts cold — the agent has no memory of the codebase's structure, key files, or patterns beyond what's in the immediate conversation context. This creates a wasteful pattern where the agent re-explains the same file structure and re-reads the same header files across multiple sessions or even within a single extended session.

The solution is **Agentic Codebase Awareness (ACA)** — a lightweight, persistent index of the project's structure and semantic knowledge that the agent can query proactively, without consuming precious context window space on boilerplate file-traversal operations.

Concretely, ACA would provide:
1. **Structural Index**: File tree, exports/imports graph, key symbols per module
2. **Semantic Index**: Summaries of what each module does (generated once, refreshed on demand)
3. **Query Interface**: Natural language queries against the index ("Where is authentication handled?", "What tools does this project have?")

ACA is not RAG. It's not embedding-based search. It's a structured, version-controlled snapshot of "what the agent needs to know about this codebase" that gets updated incrementally as the agent works.

## Key Assumptions to Validate

- [ ] **Assumption 1**: The agent actually wastes meaningful context on repeated codebase re-analysis
  → *How to test*: Analyze a session transcript for redundant file-reads that could have been cached

- [ ] **Assumption 2**: A hand-written structural index is more useful than embedding-based retrieval
  → *How to test*: Compare query accuracy vs. semantic search on a representative task set

- [ ] **Assumption 3**: Users would trust and use an auto-generated index
  → *How to test*: Small survey or usability test with 3-5 developers

## MVP Scope

**What's in:**
- `codebase index` CLI command: generates and updates `~/.codeagent/indexes/<project>/index.json`
- `index.json` structure: `{ files: [{path, exports, imports, summary}], lastUpdated, projectHash }`
- Agent queries the index at session start (passive — no new tools needed, just context injection)
- Index updates incrementally when the agent modifies files

**What's out:**
- Embedding-based semantic search (save for v2)
- IDE plugin integration
- Shared/external indexes
- Real-time sync with filesystem watchers

## Not Doing (and Why)

- **Embedding-based search** — adds complexity and dependency on an embedding service; structural index is deterministic and fast
- **Automatic index refresh on file change** — would require a background watcher; v1 is agent-driven only
- **Cross-project global index** — premature; each project should be indexed independently first
- **Cloud/shared index storage** — session-level indexing is sufficient for v1

## Open Questions

- How often does the index become stale vs. useful? (need real usage data)
- Should the index be human-readable and editable?
- What's the right granularity for "summary" per module — file-level, function-level, or concept-level?
