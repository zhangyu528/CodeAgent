/**
 * Session Utilities — shared between sessions.ts and sessionRepository.ts
 * Extracted to avoid duplication of extractMessageText.
 */
import { randomUUID } from 'crypto';

// ─── Session ID ──────────────────────────────────────────────────────────────

/** Session ID must be alphanumeric, hyphen, or underscore — rejects path traversal */
export const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_SESSION_ID_LENGTH = 255;

export function createSessionId(): string {
  try {
    return randomUUID();
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function isValidSessionId(id: string): boolean {
  return SESSION_ID_REGEX.test(id) && id.length > 0 && id.length <= MAX_SESSION_ID_LENGTH;
}

// ─── Message Text Extraction ──────────────────────────────────────────────────

/**
 * Extracts plain text from AgentMessage content.
 * Handles string, array of parts, and object formats from various providers.
 */
export function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof (item as { text?: string }).text === 'string') return (item as { text: string }).text;
        if (item && typeof (item as { content?: string }).content === 'string') return (item as { content: string }).content;
        if (item && typeof (item as { input_text?: string }).input_text === 'string') return (item as { input_text: string }).input_text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  if (content && typeof content === 'object') {
    const obj = content as { text?: string; content?: string; input_text?: string };
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.input_text === 'string') return obj.input_text;
  }
  return '';
}
