# Session Storage Abstraction (N4)

## Problem Statement

CodeAgent's `SessionManager` in `sessions.ts` directly uses JSON files on disk with no abstraction layer. This creates two problems: (1) when N5 (session governance with TTL, archival, export/import) is implemented, the file-based storage becomes a constraint; and (2) there's no migration path when the JSON schema evolves, since `SESSION_VERSION = 1` exists but no migration logic runs — it simply overwrites with version 1 schema on save.

## Recommended Direction

**Repository Pattern with Schema Versioning and Migration**

Introduce a `SessionRepository` interface with a JSON implementation (current behavior, refactored) and a future SQLite implementation. The interface defines the contract; implementations handle persistence. A migration runner applies sequential migrations on load.

```typescript
interface SessionRepository {
  save(id: string, record: SessionRecord): Promise<void>;
  load(id: string): Promise<SessionRecord | null>;
  list(limit?: number): Promise<SessionInfo[]>;
  delete(id: string): Promise<void>;
  migrate(): Promise<void>; // runs pending migrations
}

class JsonSessionRepository implements SessionRepository {
  // current sessions.ts behavior, refactored into this class
  // runs migrations on construction
}

class SqliteSessionRepository implements SessionRepository {
  // future: SQLite backend via better-sqlite3
  // same interface, transparent to callers
}
```

### Migration System

```typescript
const MIGRATIONS: Migration[] = [
  {
    from: 0, to: 1,
    up: (doc: any) => { doc.version = 1; return doc; },
  },
  // future:
  // {
  //   from: 1, to: 2,
  //   up: (doc: any) => { doc.meta.provider = doc.meta.provider || 'unknown'; return doc; },
  // },
];
```

On `load()`, check `doc.version`, run all `MIGRATIONS[n].up` for n in (doc.version..latest], save migrated doc.

## Key Assumptions to Validate

- [ ] `pi-agent-core` does not already own session persistence (confirm `AgentMessage` shape matches)
- [ ] JSON implementation can be refactored without breaking existing session files
- [ ] Migration direction is forward-only (no need for down migrations in MVP)

## MVP Scope

1. Extract `SessionRepository` interface to a new file `src/agent/sessionRepository.ts`
2. Move current JSON logic from `sessions.ts` → `JsonSessionRepository` implementing the interface
3. Add migration runner (even if only one version, the runner must exist)
4. Update `SessionManager` to use `SessionRepository` (initially with `JsonSessionRepository`)
5. N5 features (TTL, archival) become new implementations of the same interface

## Not Doing (and Why)

- **SQLite implementation**: deferred to N5 scope; the interface enables this without N4 doing it
- **Down migrations**: JSON schema is simple enough that forward-only is acceptable for MVP
- **Compression**: future optimization, not in N4 scope

## Open Questions

- Should `SessionRepository` live in `src/agent/` or `src/agent/storage/`?
- Does `pi-agent-core` expose any hooks we should integrate with instead?
