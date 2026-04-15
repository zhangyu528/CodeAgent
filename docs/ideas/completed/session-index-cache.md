# Session Index Cache for Fast History Listing

## Problem Statement

The `getHistory()` method in `sessionRepository.ts` (lines 178-212) performs an O(N) file stat operation on every session file before sorting by mtime and returning a slice. For users with 100+ sessions, this means 100+ `fs.statSync` calls on every history refresh — causing UI blocking and slow `/history` display.

Additionally, `SessionManager` (sessions.ts:228-263) implements an identical N+1 pattern, creating duplicate maintenance burden.

## Recommended Direction

**Add a `sessions/index.json` metadata cache** that is updated on every session save, storing `{ sessionId, mtime, title, messageCount, lastMessageAt }`. The `getHistory()` method reads only this index file (single stat + read) and only fetches full session content on demand.

```
sessions/
  index.json          ← metadata cache (updated on every save)
  abc-123.json        ← full session content
  def-456.json
```

## Key Assumptions to Validate

1. Session files are only written through the `SessionRepository`/`SessionManager` — no outside写入
2. Users do not directly edit session JSON files outside the app
3. The index.json approach is preferred over SQLite (which requires N4 schema migration) as a near-term fix

## MVP Scope

1. Add `index.json` schema: `{ sessions: [{ id, mtime, title, messageCount }] }`
2. Update `JsonSessionRepository.saveSession()` to rebuild index after each save
3. Update `JsonSessionRepository.getHistory()` to read only `index.json`
4. Update `SessionManager` to delegate to `JsonSessionRepository` (remove duplication)
5. Add migration: on startup, if `index.json` is missing or stale, rebuild from session files

## Not Doing (and Why)

- **SQLite migration**: Belongs to N4 roadmap. This proposal is a near-term fix that doesn't require schema design.
- **Elasticsearch / full-text search**: N5 territory. This proposal only addresses listing speed.
- **Automatic title extraction**: Nice-to-have but out of scope. Title remains `message[0]?.text.slice(0, 50)`.

## Open Questions

1. Should `index.json` be written synchronously (simpler, risk of corruption) or via a write queue (safer, slight delay)?
2. How to handle concurrent writes from multiple CLI instances? (File locking or last-write-wins acceptable for MVP)
3. Should the index store `lastMessageAt` or just `mtime` for sorting purposes?
