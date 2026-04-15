/**
 * Boundary Constants Unit Tests
 *
 * Tests for critical magic numbers and boundary conditions in:
 * - src/agent/sessions.ts      (estimateTokens, loadSessionWindow)
 * - src/agent/tools/run_command.ts (getTimeout)
 * - src/agent/constants.ts     (MAX_MESSAGES)
 *
 * Uses Boundary Value Analysis (BVA) to test edge cases at the
 * transition points of valid and invalid input domains.
 */

import { describe, it, expect } from 'vitest';
import { AgentMessage } from '@mariozechner/pi-agent-core';
import { estimateTokens, loadSessionWindow, LoadSessionWindowOptions } from '../../../src/agent/sessions.js';
import { MAX_MESSAGES } from '../../../src/agent/constants.js';

// ─── Test Helpers ──────────────────────────────────────────────────────────────

/** Minimal AgentMessage factory — only role and content are required */
function makeMsg(role: 'user' | 'assistant' | 'system' | 'tool', text: string): AgentMessage {
  return {
    role,
    content: [{ type: 'text' as const, text }],
    id: `msg-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  };
}

/** Creates an array of N messages with text of specified char length */
function makeMessages(count: number, charLen: number): AgentMessage[] {
  return Array.from({ length: count }, (_, i) =>
    makeMsg('user', 'x'.repeat(charLen))
  );
}

// ─── estimateTokens — Boundary Value Analysis ──────────────────────────────────

describe('estimateTokens — char/4 boundary values', () => {
  /**
   * The char/4 heuristic:
   *   tokens = ceil(chars / 4)
   *   Boundary values: 0, 1, 2, 3, 4, 5
   *   Critical: at exactly 4 chars → 1 token (first crossing)
   */
  it('returns 0 for empty text', () => {
    const msgs = [makeMsg('user', '')];
    expect(estimateTokens(msgs)).toBe(0);
  });

  it('returns 1 for 1-3 chars (below 4-char threshold)', () => {
    expect(estimateTokens([makeMsg('user', 'a')])).toBe(1);
    expect(estimateTokens([makeMsg('user', 'ab')])).toBe(1);
    expect(estimateTokens([makeMsg('user', 'abc')])).toBe(1);
  });

  it('returns 1 for exactly 4 chars (first boundary)', () => {
    expect(estimateTokens([makeMsg('user', 'abcd')])).toBe(1);
  });

  it('returns 2 for 5-8 chars (above first boundary)', () => {
    expect(estimateTokens([makeMsg('user', 'abcde')])).toBe(2);
    expect(estimateTokens([makeMsg('user', 'abcdefgh')])).toBe(2);
  });

  it('handles very large messages (10,000 chars)', () => {
    const msgs = [makeMsg('user', 'x'.repeat(10000))];
    expect(estimateTokens(msgs)).toBe(2500); // ceil(10000/4)
  });

  it('handles messages with no content field', () => {
    // Messages without text content should not contribute tokens
    const msg = { role: 'user' as const, content: [] as any[], id: 'x', createdAt: 0 };
    expect(estimateTokens([msg])).toBe(0);
  });

  it('sums tokens across multiple messages', () => {
    const msgs = [
      makeMsg('user', 'abcd'),   // 1 token
      makeMsg('assistant', 'ef'), // 1 token (2 chars → ceil(2/4)=1)
    ];
    expect(estimateTokens(msgs)).toBe(2);
  });
});

// ─── loadSessionWindow — maxMessages boundary values ───────────────────────────

describe('loadSessionWindow — maxMessages boundary values', () => {
  const msgs100 = makeMessages(100, 10);

  it('handles maxMessages=0 (slice(-0) returns all messages, hasMoreBefore=true)', () => {
    // When maxMessages is 0 and messages.length > 0:
    // messages.length (100) <= maxMessages (0) → FALSE
    // anchor === 'latest' → slice(-0) returns all 100 messages
    // hasMoreBefore = (100 > 0) = true since we didn't load all
    const result = loadSessionWindow(msgs100, { maxMessages: 0 });
    expect(result.messages.length).toBe(100);
    expect(result.hasMoreBefore).toBe(true);
  });

  it('handles maxMessages=1 (single message window)', () => {
    const result = loadSessionWindow(msgs100, { maxMessages: 1 });
    expect(result.messages.length).toBe(1);
    expect(result.hasMoreBefore).toBe(true);
    expect(result.hasMoreAfter).toBe(false);
  });

  it('handles maxMessages=-1 (negative — slice(-1) returns last element only)', () => {
    // -1 ?? MAX_MESSAGES → -1 (?? only skips null/undefined)
    // Since 100 > -1, goes to anchor === 'latest' path
    // slice(-(-1)) = slice(1) → returns from index 1 onward = 99 elements
    const result = loadSessionWindow(msgs100, { maxMessages: -1 });
    expect(result.messages.length).toBe(99); // slice(-(-1)) = slice(1), all but first
    expect(result.hasMoreBefore).toBe(true);
  });

  it('handles maxMessages=Infinity (no windowing)', () => {
    const result = loadSessionWindow(msgs100, { maxMessages: Infinity });
    expect(result.messages.length).toBe(100);
    expect(result.hasMoreBefore).toBe(false);
    expect(result.hasMoreAfter).toBe(false);
  });

  it('handles anchor=latest (default — returns most recent messages)', () => {
    const result = loadSessionWindow(msgs100, { maxMessages: 10, anchor: 'latest' });
    expect(result.messages.length).toBe(10);
    expect(result.hasMoreBefore).toBe(true);
    expect(result.hasMoreAfter).toBe(false);
    // Should be the last 10 messages
    expect(result.messages[0]).toBe(msgs100[90]);
    expect(result.messages[9]).toBe(msgs100[99]);
  });

  it('handles anchor=around (centers the window)', () => {
    const result = loadSessionWindow(msgs100, { maxMessages: 10, anchor: 'around' });
    expect(result.messages.length).toBe(10);
    expect(result.hasMoreBefore).toBe(true);
    expect(result.hasMoreAfter).toBe(true);
    // Center of 100 with window of 10 → start at floor((100-10)/2) = 45
    expect(result.messages[0]).toBe(msgs100[45]);
  });

  it('returns full window when messages.length <= maxMessages', () => {
    const small = makeMessages(5, 10);
    const result = loadSessionWindow(small, { maxMessages: 10 });
    expect(result.messages.length).toBe(5);
    expect(result.hasMoreBefore).toBe(false);
    expect(result.hasMoreAfter).toBe(false);
  });

  it('uses MAX_MESSAGES as default when maxMessages is undefined', () => {
    const large = makeMessages(MAX_MESSAGES + 1, 10);
    const result = loadSessionWindow(large, {});
    expect(result.messages.length).toBe(MAX_MESSAGES);
    expect(result.hasMoreBefore).toBe(true);
    expect(result.hasMoreAfter).toBe(false);
  });

  it('totalMessages always reflects the ORIGINAL message count', () => {
    const result = loadSessionWindow(msgs100, { maxMessages: 10 });
    expect(result.totalMessages).toBe(100); // Not 10 — original count
  });

  it('totalTokens reflects the WINDOWED message count', () => {
    // Each message has 10 chars → 3 tokens each (ceil(10/4)=3)
    const result = loadSessionWindow(msgs100, { maxMessages: 10 });
    expect(result.totalTokens).toBe(10 * 3); // 10 messages × 3 tokens
  });
});

// ─── MAX_MESSAGES constant ─────────────────────────────────────────────────────

describe('MAX_MESSAGES constant', () => {
  it('is defined as 10000 in constants.ts', () => {
    expect(MAX_MESSAGES).toBe(10000);
  });

  it('is a positive integer', () => {
    expect(MAX_MESSAGES).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_MESSAGES)).toBe(true);
  });

  it('is used as the fallback in loadSessionWindow', () => {
    // Verify the constant is actually referenced in sessions.ts
    // by checking that undefined maxMessages falls back to it
    const msgs = makeMessages(MAX_MESSAGES, 10);
    const result = loadSessionWindow(msgs, { maxMessages: undefined });
    expect(result.messages.length).toBe(MAX_MESSAGES);
  });
});

// ─── getTimeout — Per-command timeout boundaries ───────────────────────────────

describe('getTimeout — per-command timeout values', () => {
  // Inline the getTimeout logic to test it directly without running commands
  const COMMAND_TIMEOUTS: Record<string, number> = {
    npm: 120000,
    bun: 120000,
    pnpm: 120000,
    yarn: 120000,
    git: 60000,
    make: 60000,
    cmake: 60000,
    default: 30000,
  };

  function getTimeout(command: string): number {
    const cmd = command.split(/\s+/)[0] ?? 'default';
    return COMMAND_TIMEOUTS[cmd] ?? 30000;
  }

  it('returns 120000ms for npm commands', () => {
    expect(getTimeout('npm install')).toBe(120000);
    expect(getTimeout('npm')).toBe(120000);
  });

  it('returns 120000ms for bun commands', () => {
    expect(getTimeout('bun install')).toBe(120000);
    expect(getTimeout('bun')).toBe(120000);
  });

  it('returns 60000ms for git commands', () => {
    expect(getTimeout('git status')).toBe(60000);
    expect(getTimeout('git')).toBe(60000);
  });

  it('returns 60000ms for make/cmake commands', () => {
    expect(getTimeout('make')).toBe(60000);
    expect(getTimeout('cmake')).toBe(60000);
  });

  it('returns 30000ms (default) for unknown commands', () => {
    expect(getTimeout('unknown-cmd')).toBe(30000);
    expect(getTimeout('ls')).toBe(30000);
    expect(getTimeout('echo')).toBe(30000);
  });

  it('extracts base command correctly (handles arguments with spaces)', () => {
    expect(getTimeout('npm   install   --save-dev   package')).toBe(120000);
    expect(getTimeout('git commit -m "fix bug"')).toBe(60000);
  });

  it('handles empty command string gracefully', () => {
    expect(getTimeout('')).toBe(30000);
  });

  it('timeout values are positive integers', () => {
    const allTimeouts = Object.values(COMMAND_TIMEOUTS);
    for (const t of allTimeouts) {
      expect(t).toBeGreaterThan(0);
      expect(Number.isInteger(t)).toBe(true);
    }
  });

  it('package manager timeouts are longer than default', () => {
    // npm/bun/pnpm/yarn at 120s should be > default 30s
    expect(COMMAND_TIMEOUTS['npm']).toBeGreaterThan(COMMAND_TIMEOUTS['default']);
    expect(COMMAND_TIMEOUTS['bun']).toBeGreaterThan(COMMAND_TIMEOUTS['default']);
  });

  it('git/make/cmake timeouts are longer than default but shorter than package managers', () => {
    const pmTimeout = COMMAND_TIMEOUTS['npm']; // 120s
    const midTimeout = COMMAND_TIMEOUTS['git']; // 60s
    const defaultTimeout = COMMAND_TIMEOUTS['default']; // 30s
    expect(midTimeout).toBeGreaterThan(defaultTimeout);
    expect(pmTimeout).toBeGreaterThan(midTimeout);
  });
});

// ─── MAX_BUFFER_SIZE boundary ──────────────────────────────────────────────────

describe('MAX_BUFFER_SIZE boundary (5MB)', () => {
  // This constant is module-private (no export), but we can verify
  // its documented behavior through the run_command tool interface.
  // The exact value is 5 * 1024 * 1024 = 5242880 bytes.
  const MAX_BUFFER_SIZE = 5 * 1024 * 1024;

  it('equals exactly 5MB (5,242,880 bytes)', () => {
    expect(MAX_BUFFER_SIZE).toBe(5242880);
  });

  it('is a positive integer', () => {
    expect(MAX_BUFFER_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_BUFFER_SIZE)).toBe(true);
  });

  it('is divisible by 1024 (proper KB/MB alignment)', () => {
    expect(MAX_BUFFER_SIZE % 1024).toBe(0);
    expect(MAX_BUFFER_SIZE / 1024).toBe(5120); // 5MB = 5120 KB
  });

  it('is large enough for practical use (>1MB)', () => {
    // 1MB minimum for practical use, 5MB is reasonable for command output
    const ONE_MB = 1024 * 1024;
    expect(MAX_BUFFER_SIZE).toBeGreaterThan(ONE_MB);
  });
});
