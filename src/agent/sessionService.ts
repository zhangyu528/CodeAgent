/**
 * Session Service — Business Logic Layer
 *
 * Handles parameter transformation, default value injection,
 * and schema normalization for session records.
 *
 * Separated from sessionRepository.ts to keep storage drivers (SQLite/JSON)
 * focused on persistence, while this layer handles business rules.
 *
 * @see docs/ideas/session-storage-abstraction.md (N4)
 */

import { AgentMessage } from '@mariozechner/pi-agent-core';
import { SESSION_VERSION } from './constants.js';
import { extractMessageText } from './sessionUtils.js';
import type { SessionDocument } from './sessionMigrations.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'completed' | 'interrupted' | 'error';

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  model: string;
  provider: string;
  status: SessionStatus;
  version: number;
}

export interface SessionInfo extends SessionMeta {}

export interface SessionRecord {
  id: string;
  title: string;
  messages: AgentMessage[];
  meta: SessionMeta;
}

export interface SaveSessionOptions {
  status?: SessionStatus;
  model?: string;
  provider?: string;
  title?: string;
}

// ─── Build Document ───────────────────────────────────────────────────────────

/**
 * Builds a SessionDocument from raw inputs, applying business defaults.
 */
export function buildSessionDocument(
  id: string,
  messages: AgentMessage[],
  options: SaveSessionOptions = {}
): SessionDocument {
  return {
    version: SESSION_VERSION,
    meta: {
      id,
      title: options.title || extractTitle(messages) || 'New Session',
      updatedAt: Date.now(),
      messageCount: messages.length,
      model: options.model || 'unknown',
      provider: options.provider || 'unknown',
      status: options.status || 'completed',
      version: SESSION_VERSION,
    },
    messages,
  };
}

// ─── Normalize Record ────────────────────────────────────────────────────────

/**
 * Normalizes a parsed JSON document into a SessionRecord.
 * Handles missing fields, type coercion, and schema migration defaults.
 * Returns null if the document is structurally invalid.
 */
export function normalizeSessionRecord(
  _fallbackId: string,
  parsed: unknown
): SessionRecord | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const p = parsed as Record<string, unknown>;
  if (!p.meta || !Array.isArray(p.messages)) return null;

  const meta = p.meta as Record<string, unknown>;
  if (!meta.id || !meta.title || !meta.updatedAt) return null;

  const messages = p.messages as AgentMessage[];

  return {
    id: meta.id as string,
    title: (meta.title as string) || 'New Session',
    messages,
    meta: {
      id: meta.id as string,
      title: (meta.title as string) || 'New Session',
      updatedAt: meta.updatedAt as number,
      messageCount:
        typeof meta.messageCount === 'number'
          ? (meta.messageCount as number)
          : messages.length,
      model: (meta.model as string) || 'unknown',
      provider: (meta.provider as string) || 'unknown',
      status: ((meta.status as string) || 'completed') as SessionStatus,
      version: (meta.version as number) || SESSION_VERSION,
    },
  };
}

// ─── Extract Title ────────────────────────────────────────────────────────────

/**
 * Extracts a human-readable title from the first user message.
 * Returns null if no user message exists or content is empty.
 */
export function extractTitle(messages: AgentMessage[]): string | null {
  if (messages.length === 0) return null;
  const firstUserMsg = messages.find(m => m.role === 'user');
  const content = extractMessageText((firstUserMsg as AgentMessage | undefined)?.content);
  if (!content) return null;
  const text = content.trim();
  return text.length > 40 ? text.slice(0, 40) + '...' : text;
}

// ─── Validate ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the given value is a valid SessionRecord shape.
 * Used by callers to verify record integrity before use.
 */
export function isValidSessionRecord(record: unknown): record is SessionRecord {
  if (!record || typeof record !== 'object') return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    Array.isArray(r.messages) &&
    typeof r.meta === 'object' &&
    r.meta !== null
  );
}
