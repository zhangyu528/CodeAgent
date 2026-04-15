# Session Lifecycle Governance

## Problem Statement

How Might We give users control over session storage growth, privacy, and lifecycle without breaking the `/resume` and `/history` workflows that depend on persisted sessions?

CodeAgent persists all sessions to SQLite by default, but there's no mechanism to:
- Enforce session TTL or auto-archive stale sessions
- Selectively delete sensitive sessions (e.g., sessions containing API keys in tool calls)
- Export/import sessions for backup or migration
- Understand session-level cost and token usage per conversation

## Recommended Direction

Introduce a **Session Lifecycle Manager** with three components:

### 1. Session Registry CLI (`/sessions` slash command)
A new slash command that lists, filters, and manages saved sessions:
```
/sessions list          → show recent sessions with metadata
/sessions delete <id>   → delete specific session
/sessions archive       → archive sessions older than 30 days
/sessions export        → export session to JSON
/sessions import <file> → restore from JSON
```

### 2. Session Metadata Augmentation
Before writing a session to SQLite, capture:
- `created_at`, `last_active_at`, `message_count`, `tool_call_count`
- `estimated_tokens` (from trajectory data if available)
- `has_sensitive_data` flag (heuristic: detects API key patterns in tool calls)

### 3. Lifecycle Policies (config-driven)
In `config.yaml`:
```yaml
session_lifecycle:
  ttl_days: 90              # auto-archive after N days
  auto_archive: true        # move to archive instead of delete
  max_sessions: 500         # warn when approaching limit
  sensitive_data_policy: "prompt"  # prompt before persisting if detected
```

## Key Assumptions to Validate

- [ ] **Assumption 1**: Users actually want auto-expiry of old sessions. Validate via survey or by tracking how often `/history` is used vs. `/new`.
- [ ] **Assumption 2**: The existing SQLite schema can be extended with migration support (see N4 `session-storage-abstraction` idea which already proposes this).
- [ ] **Assumption 3**: Sensitive data detection (API keys in tool calls) is feasible with a regex heuristic without false positives.

## MVP Scope

**In:**
- `/sessions` slash command with `list` and `delete` sub-commands
- Session metadata columns: `created_at`, `last_active_at`, `message_count`
- Config: `session_lifecycle.ttl_days` and `session_lifecycle.auto_archive`
- Archive workflow: move stale sessions to `sessions_archive` table (same DB)

**Out:**
- Export/import (defer to N5)
- Cost/token aggregation (defer to N5)
- Sensitive data auto-detection (defer to future)
- UI changes to chat page (session info display)

## Not Doing (and Why)

- **Full export/import pipeline**: Important but not MVP. N5 covers this.
- **Sensitive data auto-detection in MVP**: Too risky without user confirmation. Defer with `sensitive_data_policy: "prompt"`.
- **Cost aggregation**: Requires per-message token counting, adds complexity. N5 scope.
- **Changes to `/resume` behavior**: Current resume is fine. Lifecycle management is orthogonal.

## Open Questions

- Should archived sessions still appear in `/history`? Or only active sessions?
- What's the interaction between lifecycle policies and the `/resume` command — should resumed sessions have their TTL reset?
- Should session metadata be stored in a separate metadata DB/file, or augment the existing sessions table?
