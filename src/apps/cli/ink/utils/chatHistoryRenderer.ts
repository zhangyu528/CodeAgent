/**
 * chatHistoryRenderer.ts — Escape-sequence-based history renderer
 *
 * Completed messages are written directly to the terminal's scrollback buffer
 * via ANSI escape sequences. The React overlay only renders:
 *   - The Header
 *   - The currently streaming (in-progress) message
 *   - The Input area
 *
 * This means:
 *   ✅ Mouse wheel scrolling works (native terminal scrollback)
 *   ✅ No React re-renders for history messages
 *   ✅ True streaming — pending text updates go through the same escape path
 *
 * Layout (from bottom):
 *   [Input area — React, always visible]
 *   [Current streaming message — React]
 *   ─── DECSTBM scroll boundary ───
 *   [History — written to terminal scrollback, native scroll]
 *
 * Before entering chat, call initHistoryRegion() to establish the scroll region.
 * On resize, call resizeOverlay() to re-establish layout.
 */

import {
  hideCursor,
  moveCursor,
  clearEOL,
  clearEOS,
  cursorUp,
  cr,
  newline,
  bell,
} from './terminalUtils.js';
import type { ChatMessage, ChatMessageBlock } from '../pages/types.js';

// ─── ANSI Color Escape Sequences ─────────────────────────────────────────────

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;

function color(fg: number): string {
  return `${ESC}38;5;${fg}m`;
}
function boldColor(fg: number): string {
  return `${BOLD}${ESC}38;5;${fg}m`;
}

// Role colors (256-color palette)
const C_USER = color(51); // cyan
const C_ASSISTANT = color(75); // blue
const C_ERROR = color(196); // red
const C_SYSTEM = color(228); // yellow
const C_BORDER = color(240); // gray border
const C_ROLE_LABEL = color(245); // dim gray role label
const C_THINKING = color(241); // dark gray for thinking/reasoning
const C_TOOLS = color(222); // amber for tool summaries
const C_STREAMING = color(229); // bright yellow for "streaming..." indicator

// ─── Line Counting ────────────────────────────────────────────────────────────

/**
 * Count how many terminal lines a text string will occupy given a column width.
 */
function countLines(text: string, columns: number): number {
  if (!text || columns <= 0) return 0;
  const cols = Math.max(1, columns);
  let count = 0;
  let pos = 0;
  const len = text.length;
  while (pos < len) {
    const chunk = text.slice(pos, pos + cols);
    pos += chunk.length;
    // Handle trailing ANSI escapes — strip them for length calc
    const stripped = chunk.replace(/\x1b\[[0-9;]*m/g, '');
    count += Math.max(1, Math.ceil(stripped.length / cols));
  }
  // Simpler: split by \n, count remaining lines
  const lines = text.split('\n');
  count = 0;
  for (const line of lines) {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    count += Math.max(1, Math.ceil(stripped.length / cols));
  }
  return count;
}

/**
 * Strip ANSI escape sequences from a string.
 */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Get terminal columns (from stdout.columns, defaulting to 80).
 */
export function getColumns(): number {
  return process.stdout.columns || 80;
}

// ─── Message Formatting ───────────────────────────────────────────────────────

function formatRoleLabel(role: string): string {
  const label = role === 'assistant' ? 'Assistant' : role === 'user' ? 'You' : role.toUpperCase();
  const fg = role === 'assistant' ? 75 : role === 'user' ? 51 : role === 'error' ? 196 : 228;
  return `${boldColor(fg)}${BOLD}${label}${RESET}`;
}

function formatBlock(block: ChatMessageBlock, columns: number): string[] {
  const lines: string[] = [];
  const indent = '  ';

  switch (block.kind) {
    case 'thinking':
    case 'reasoning': {
      lines.push(
        `${DIM}${C_THINKING}▸ [${block.kind === 'thinking' ? 'Thinking' : 'Reasoning'}]${RESET}`
      );
      if (!block.collapsed) {
        const wrapped = wrapText(block.text, columns - 4);
        for (const l of wrapped) lines.push(`${DIM}${C_THINKING}${indent}${l}${RESET}`);
      }
      break;
    }
    case 'toolSummary': {
      lines.push(`${DIM}${C_TOOLS}▸ [Tools]${RESET}`);
      if (!block.collapsed) {
        const wrapped = wrapText(block.text, columns - 4);
        for (const l of wrapped) lines.push(`${DIM}${C_TOOLS}${indent}${l}${RESET}`);
      }
      break;
    }
    case 'text':
    default: {
      const wrapped = wrapText(block.text, columns - 2);
      for (const l of wrapped) lines.push(l);
      break;
    }
  }
  return lines;
}

function wrapText(text: string, maxCols: number): string[] {
  if (maxCols <= 0) return [text];
  const result: string[] = [];
  const rawLines = text.split('\n');
  for (const raw of rawLines) {
    if (raw.length === 0) {
      result.push('');
      continue;
    }
    let pos = 0;
    while (pos < raw.length) {
      result.push(raw.slice(pos, pos + maxCols));
      pos += maxCols;
    }
  }
  return result;
}

function formatMessage(msg: ChatMessage, columns: number): string[] {
  const roleColor =
    msg.role === 'user'
      ? C_USER
      : msg.role === 'assistant'
        ? C_ASSISTANT
        : msg.role === 'error'
          ? C_ERROR
          : C_SYSTEM;
  const borderChar = '│';
  const lines: string[] = [];

  // Top border
  lines.push(`${C_BORDER}${borderChar}${RESET}`);

  // Role label + status
  const statusSuffix = msg.status === 'streaming' ? ` ${C_STREAMING}⋯${RESET}` : '';
  lines.push(`${C_BORDER}${borderChar}${RESET} ${formatRoleLabel(msg.role)}${statusSuffix}`);

  // Blocks
  for (const block of msg.blocks) {
    const blockLines = formatBlock(block, columns);
    for (const l of blockLines) {
      lines.push(`${C_BORDER}${borderChar}${RESET} ${l}`);
    }
  }

  // Bottom border
  lines.push(`${C_BORDER}${borderChar}${RESET}`);

  return lines;
}

// ─── History Renderer ──────────────────────────────────────────────────────────

/**
 * Manages the terminal history region (above the React overlay).
 * Messages are written directly to the terminal via ANSI escape sequences.
 */
export class ChatHistoryRenderer {
  /** Lines currently in the history region (pending line excluded) */
  private historyLines: string[] = [];
  /** The currently streaming message being updated in-place */
  private pendingLines: string[] = [];
  /** Number of terminal rows occupied by the React overlay */
  private overlayRows: number = 0;
  /** Total terminal rows */
  private terminalRows: number = 24;
  /** Whether history region has been initialized */
  private initialized: boolean = false;

  constructor() {
    // Bind methods
    this.writeMessage = this.writeMessage.bind(this);
    this.updatePending = this.updatePending.bind(this);
    this.erasePending = this.erasePending.bind(this);
    this.setOverlayRows = this.setOverlayRows.bind(this);
    this.initHistory = this.initHistory.bind(this);
    this.resize = this.resize.bind(this);
    this.getHistoryLineCount = this.getHistoryLineCount.bind(this);
    this.clear = this.clear.bind(this);
  }

  /**
   * Initialize the history region.
   * Must be called after entering chat mode and before writing any history.
   * Sets up the scroll region from row 1 to (terminalRows - overlayRows).
   */
  initHistory(terminalRows: number, overlayRows: number): void {
    this.terminalRows = terminalRows;
    this.overlayRows = overlayRows;
    this.historyLines = [];
    this.pendingLines = [];
    this.initialized = true;
    // Clear the history region
    moveCursor(1, 1);
    clearEOS();
  }

  /**
   * Resize — called on terminal resize.
   * Erases history region and reinitializes.
   */
  resize(terminalRows: number, overlayRows: number): void {
    this.terminalRows = terminalRows;
    this.overlayRows = overlayRows;
    if (!this.initialized) return;
    this.pendingLines = [];
    moveCursor(1, 1);
    clearEOS();
    this.historyLines = [];
  }

  /**
   * Update how many rows the React overlay occupies.
   */
  setOverlayRows(rows: number): void {
    this.overlayRows = rows;
  }

  /**
   * Get the number of lines currently in the history region.
   */
  getHistoryLineCount(): number {
    return this.historyLines.length;
  }

  /**
   * Clear all history and redraw.
   */
  clear(): void {
    this.historyLines = [];
    this.pendingLines = [];
    if (this.initialized) {
      moveCursor(1, 1);
      clearEOS();
    }
  }

  /**
   * Write a completed message to the history region.
   * The message is formatted and written directly to stdout.
   */
  writeMessage(msg: ChatMessage): void {
    if (!this.initialized) return;
    const columns = getColumns();
    const lines = formatMessage(msg, columns);
    this.historyLines.push(...lines);

    // Write lines to terminal
    for (const line of lines) {
      cr();
      process.stdout.write(line);
      newline();
    }
  }

  /**
   * Update the currently streaming message in-place.
   * Erases the previous pending lines and writes the new content.
   * Called on every batch of streaming deltas.
   */
  updatePending(text: string, isThinking: boolean): void {
    if (!this.initialized) return;
    const columns = getColumns();
    const newPending: string[] = [];

    if (isThinking) {
      newPending.push(`${DIM}${C_THINKING}▸ [Thinking] ${text}${RESET}`);
    } else {
      const wrapped = wrapText(text, columns - 2);
      for (const l of wrapped) {
        newPending.push(`${C_ASSISTANT}${l}${RESET}`);
      }
    }

    const prevCount = this.pendingLines.length;

    if (prevCount > 0) {
      // Move cursor to start of pending block and erase
      cursorUp(prevCount);
      for (let i = 0; i < prevCount; i++) {
        moveCursor(this.terminalRows - this.overlayRows - prevCount + i + 1, 1);
        clearEOL();
      }
      cursorUp(prevCount);
    }

    // Write new pending lines
    for (const line of newPending) {
      cr();
      process.stdout.write(line);
      newline();
    }

    this.pendingLines = newPending;
  }

  /**
   * Erase the pending streaming message.
   * Called when the streaming message completes and moves to history.
   */
  erasePending(): void {
    if (!this.initialized || this.pendingLines.length === 0) return;
    const count = this.pendingLines.length;

    cursorUp(count);
    for (let i = 0; i < count; i++) {
      moveCursor(this.terminalRows - this.overlayRows - count + i + 1, 1);
      clearEOL();
    }
    cursorUp(count);

    this.pendingLines = [];
  }

  /**
   * Flush pending to history — called when streaming finishes.
   */
  flushPendingToHistory(msg: ChatMessage): void {
    if (!this.initialized) return;
    const columns = getColumns();
    const lines = formatMessage(msg, columns);
    this.historyLines.push(...lines);
    this.pendingLines = [];
  }

  /**
   * Signal that a message batch completed — plays bell if enabled.
   */
  onBatchComplete(): void {
    // Optional: bell on completion
    // bell();
  }
}

// Singleton instance
export const chatHistoryRenderer = new ChatHistoryRenderer();
