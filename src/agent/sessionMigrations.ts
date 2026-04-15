/**
 * Session Migrations — N4 Storage Schema Migration System
 *
 * Manages sequential migrations for session document schemas.
 * Each migration is a forward-only transformation from one schema version
 * to the next, applied automatically on session load.
 *
 * The migration system is intentionally simple:
 * - No down migrations (forward-only)
 * - Migrations run sequentially on load
 * - Migrated documents are saved back with the new schema version
 *
 * @see docs/ideas/session-storage-abstraction.md (N4)
 */

import { SESSION_VERSION } from './constants.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  model: string;
  provider: string;
  status: string;
  version: number;
}

export interface SessionDocument {
  version: number;
  meta: SessionMeta;
  messages: unknown[];
}

export interface Migration {
  from: number;
  to: number;
  up: (doc: SessionDocument) => SessionDocument;
}

// ─── Migrations ───────────────────────────────────────────────────────────────

const MIGRATIONS: Migration[] = [
  {
    from: 0,
    to: 1,
    up: (doc): SessionDocument => {
      // Version 0 → 1: Initial schema. Ensure all required fields are present.
      return {
        ...doc,
        version: 1,
        meta: {
          ...doc.meta,
          version: 1,
          status: doc.meta.status || 'completed',
          model: doc.meta.model || 'unknown',
          provider: doc.meta.provider || 'unknown',
          messageCount: doc.meta.messageCount ?? doc.messages?.length ?? 0,
        },
      };
    },
  },
  // Future migrations go here:
  // {
  //   from: 1,
  //   to: 2,
  //   up: (doc) => { ... },
  // },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Runs all pending migrations on a session document.
 * Migrations are applied sequentially from current version to latest.
 */
export function runMigrations(doc: SessionDocument): SessionDocument {
  let current = doc;
  for (const migration of MIGRATIONS) {
    if (current.version < migration.to) {
      current = migration.up(current);
    }
  }
  return current;
}

/**
 * The latest schema version number. Documents at this version need no migration.
 */
export const LATEST_VERSION = SESSION_VERSION;
