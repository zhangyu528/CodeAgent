/**
 * EscapeChatPage - Full escape sequence based chat rendering
 *
 * Layout:
 *   Row 0-1:    Header (fixed)
 *   Row 2:      Separator line
 *   Row 3 to (T-5): Messages scroll region (DECSTBM)
 *   Row (T-4):  Separator line
 *   Row (T-3) to T: Input area (fixed)
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAgentEvents } from '../hooks/useAgentEvents.js';
import { useChatStore } from '../store/index.js';
import { getAgentSession } from '@codeagent/core';
import { ChatMessage } from '../pages/types.js';

const ESC = '\x1b';
const CSI = `${ESC}[`;

// ANSI escape sequences
const ansi = {
  // Cursor
  cursorTo: (row: number, col: number = 1) => `${CSI}${row};${col}H`,
  cursorForward: (n = 1) => `${CSI}${n}C`,
  cursorBack: (n = 1) => `${CSI}${n}D`,
  saveCursor: () => `${ESC}7`,
  restoreCursor: () => `${ESC}8`,

  // Clear
  clearScreen: () => `${CSI}2J`,
  clearLine: () => `${CSI}2K`,
  clearLineToEnd: () => `${CSI}0K`,

  // Scroll region (DECSTBMS)
  setScrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  scrollUp: (n = 1) => `${CSI}${n}S`,

  // Screen modes
  enterAltScreen: () => `${CSI}?1049h`,
  exitAltScreen: () => `${CSI}?1049l`,
  hideCursor: () => `${CSI}?25l`,
  showCursor: () => `${CSI}?25h`,

  // Terminal modes
  enableLineFeed: () => `${ESC}[20h`,
  disableLineFeed: () => `${ESC}[20l`,
};

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function roleColor(role: string): string {
  switch (role) {
    case 'user': return c.cyan;
    case 'assistant': return c.blue;
    case 'error': return c.red;
    default: return c.yellow;
  }
}

interface Layout {
  rows: number;
  cols: number;
  headerTop: number;
  headerBottom: number;
  scrollTop: number;
  scrollBottom: number;
  inputTop: number;
  inputBottom: number;
}

function calculateLayout(rows: number, cols: number, headerLines: number, inputLines: number): Layout {
  return {
    rows,
    cols,
    headerTop: 1,
    headerBottom: headerLines,
    scrollTop: headerLines + 1,
    scrollBottom: rows - inputLines,
    inputTop: rows - inputLines + 1,
    inputBottom: rows,
  };
}

function renderHeader(layout: Layout, sessionName?: string): void {
  const { cols, headerTop, headerBottom } = layout;
  const border = '─'.repeat(Math.min(cols - 4, 60));

  // Top border
  process.stdout.write(ansi.cursorTo(headerTop, 1));
  process.stdout.write(`${c.blue}${c.bold}┌${border}┐${c.reset}`);

  // Title
  process.stdout.write(ansi.cursorTo(headerTop + 1, 1));
  const title = sessionName ? ` Chat - ${sessionName} ` : ' CodeAgent ';
  const padding = Math.max(0, Math.floor((cols - title.length - 4) / 2));
  const titleLine = `${c.blue}│${c.reset}${' '.repeat(padding)}${c.bold}${c.white}${title}${c.reset}${' '.repeat(Math.max(0, cols - padding - title.length - 6))}${c.blue}│${c.reset}`;
  process.stdout.write(titleLine);

  // Bottom border
  process.stdout.write(ansi.cursorTo(headerBottom, 1));
  process.stdout.write(`${c.blue}${c.bold}└${border}┘${c.reset}`);
}

function renderInputArea(layout: Layout, inputText: string, cursorPos: number): void {
  const { cols, inputTop, inputBottom, scrollBottom } = layout;

  // Separator line
  const sep = '─'.repeat(Math.min(cols - 4, 60));
  process.stdout.write(ansi.cursorTo(scrollBottom + 1, 1));
  process.stdout.write(`${c.cyan}├${sep}┤${c.reset}`);

  // Input prompt line
  const prompt = `${c.cyan}>${c.reset} `;
  const promptLen = 2;

  process.stdout.write(ansi.cursorTo(inputTop, 1));
  process.stdout.write(ansi.clearLine());
  process.stdout.write(prompt);

  // Render input text with cursor
  const maxWidth = cols - promptLen - 2;
  const displayText = inputText.length > maxWidth
    ? '...' + inputText.slice(-maxWidth + 3)
    : inputText;

  const cursorOffset = Math.min(cursorPos, displayText.length);

  // Text before cursor
  if (cursorOffset > 0) {
    process.stdout.write(displayText.slice(0, cursorOffset));
  }

  // Cursor
  process.stdout.write(`${c.yellow}${c.bold}_${c.reset}`);

  // Text after cursor
  if (cursorOffset < displayText.length) {
    process.stdout.write(displayText.slice(cursorOffset));
  }

  process.stdout.write(ansi.clearLineToEnd());

  // Input area background hint
  const hint = `${c.dim}Press Enter to send, Ctrl+C to exit${c.reset}`;
  process.stdout.write(ansi.cursorTo(inputTop + 1, 1));
  process.stdout.write(ansi.clearLine());
  process.stdout.write(hint);

  // Separator bottom
  process.stdout.write(ansi.cursorTo(inputBottom, 1));
  process.stdout.write(`${c.cyan}└${sep}┘${c.reset}`);
}

function formatMessage(msg: ChatMessage, maxWidth: number): string[] {
  const lines: string[] = [];
  const color = roleColor(msg.role);
  const border = `${c.dim}│${c.reset}`;
  const indent = ' ';

  // Role label
  lines.push(`${border} ${color}${c.bold}${msg.role}${c.reset}`);

  // Blocks
  for (const block of msg.blocks) {
    let text = block.text;

    // Handle collapsed blocks
    if (block.kind === 'thinking' || block.kind === 'reasoning' || block.kind === 'toolSummary') {
      const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
      if (collapsed) {
        text = `▸ [${block.kind === 'toolSummary' ? 'Tools' : block.kind.charAt(0).toUpperCase() + block.kind.slice(1)}]`;
      } else {
        text = `▾ [${block.kind === 'toolSummary' ? 'Tools' : block.kind.charAt(0).toUpperCase() + block.kind.slice(1)}]\n${text}`;
      }
    }

    // Wrap long lines
    const textLines = text.split('\n');
    for (const line of textLines) {
      if (line.length > maxWidth - 4) {
        // Simple word wrap
        const words = line.split(' ');
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + ' ' + word).length > maxWidth - 4) {
            if (currentLine) lines.push(`${border}${indent}${currentLine}`);
            currentLine = word;
          } else {
            currentLine = currentLine ? `${currentLine} ${word}` : word;
          }
        }
        if (currentLine) lines.push(`${border}${indent}${currentLine}`);
      } else {
        lines.push(`${border}${indent}${line}`);
      }
    }
  }

  return lines;
}

export function EscapeChatPage() {
  const session = getAgentSession();
  const agent = session.agent;
  const messages = useChatStore(state => state.messages);
  const currentSession = useChatStore(state => state.currentSession);
  const addMessage = useChatStore(state => state.addMessage);
  const updateLastMessage = useChatStore(state => state.updateLastMessage);

  const [inputText, setInputText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const layoutRef = useRef<Layout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    hydrateFromAgentState,
    appendUserMessage,
  } = useAgentEvents(session, {
    isRawModeSupported: false,
    onRawModeChange: () => {},
    onTurnSettled: (status) => {
      useChatStore.getState().persistCurrentSession(status, agent.state.messages as any);
    },
  });

  // Initialize terminal
  useEffect(() => {
    // Enter alternate screen and hide cursor
    process.stdout.write(ansi.enterAltScreen());
    process.stdout.write(ansi.clearScreen());
    process.stdout.write(ansi.hideCursor());

    // Calculate initial layout
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    layoutRef.current = calculateLayout(rows, cols, 2, 3);

    // Initial render
    renderAll();

    // Setup stdin for input
    process.stdin.setRawMode?.(true);
    process.stdin.resume?.();
    process.stdin.setEncoding?.('utf-8');

    // Handle resize
    const handleResize = () => {
      const rows = process.stdout.rows || 24;
      const cols = process.stdout.columns || 80;
      layoutRef.current = calculateLayout(rows, cols, 2, 3);
      renderAll();
    };
    process.stdout.on('resize', handleResize);

    // Cleanup
    return () => {
      process.stdout.write(ansi.exitAltScreen());
      process.stdout.write(ansi.showCursor());
      process.stdout.write(ansi.clearScreen());
      process.stdin.setRawMode?.(false);
      process.stdout.off('resize', handleResize);
    };
  }, []);

  // Render all UI
  const renderAll = useCallback(() => {
    if (!layoutRef.current) return;

    const layout = layoutRef.current;
    const maxWidth = layout.cols - 2;

    // Clear scroll region
    process.stdout.write(ansi.setScrollRegion(layout.scrollTop, layout.scrollBottom));
    for (let r = layout.scrollTop; r <= layout.scrollBottom; r++) {
      process.stdout.write(ansi.cursorTo(r, 1));
      process.stdout.write(ansi.clearLine());
    }

    // Render header
    renderHeader(layout, currentSession?.title);

    // Render messages in scroll region
    for (const msg of messages) {
      const lines = formatMessage(msg, maxWidth);
      for (const line of lines) {
        // Move to end of scroll region
        process.stdout.write(ansi.cursorTo(layout.scrollBottom, 1));
        // Scroll up to make room
        process.stdout.write(ansi.scrollUp(1));
        // Write at new bottom
        process.stdout.write(ansi.cursorTo(layout.scrollBottom, 1));
        process.stdout.write(ansi.clearLine());
        process.stdout.write(line);
      }
    }

    // Ensure cursor is at input position
    process.stdout.write(ansi.setScrollRegion(1, layout.rows));
    process.stdout.write(ansi.cursorTo(layout.inputTop, 3 + cursorPos));

  }, [messages, currentSession, cursorPos]);

  // Re-render on messages change
  useEffect(() => {
    renderAll();
  }, [messages, currentSession, renderAll]);

  // Handle input
  useEffect(() => {
    const handleKeypress = (chunk: string, key?: { name?: string; ctrl?: boolean }) => {
      if (!layoutRef.current) return;

      const layout = layoutRef.current;

      if (key?.ctrl && key.name === 'c') {
        // Exit
        process.stdout.write(ansi.exitAltScreen());
        process.stdout.write(ansi.showCursor());
        process.stdout.write(ansi.clearScreen());
        process.exit(0);
        return;
      }

      if (key?.name === 'return' || key?.name === 'enter') {
        // Submit
        const text = inputText.trim();
        if (text) {
          appendUserMessage(text);
          setInputText('');
          setCursorPos(0);
          // Agent will handle the response
        }
        return;
      }

      if (key?.name === 'backspace') {
        if (cursorPos > 0 && inputText.length > 0) {
          const newText = inputText.slice(0, cursorPos - 1) + inputText.slice(cursorPos);
          setInputText(newText);
          setCursorPos(cursorPos - 1);
        }
        return;
      }

      if (key?.name === 'delete') {
        if (cursorPos < inputText.length) {
          const newText = inputText.slice(0, cursorPos) + inputText.slice(cursorPos + 1);
          setInputText(newText);
        }
        return;
      }

      if (key?.name === 'leftArrow') {
        if (cursorPos > 0) {
          setCursorPos(cursorPos - 1);
        }
        return;
      }

      if (key?.name === 'rightArrow') {
        if (cursorPos < inputText.length) {
          setCursorPos(cursorPos + 1);
        }
        return;
      }

      if (key?.name === 'home') {
        setCursorPos(0);
        return;
      }

      if (key?.name === 'end') {
        setCursorPos(inputText.length);
        return;
      }

      // Regular character
      if (chunk && !key?.ctrl && !key?.meta) {
        const newText = inputText.slice(0, cursorPos) + chunk + inputText.slice(cursorPos);
        setInputText(newText);
        setCursorPos(cursorPos + chunk.length);
      }
    };

    process.stdin.on('data', handleKeypress);

    return () => {
      process.stdin.off('data', handleKeypress);
    };
  }, [inputText, cursorPos, appendUserMessage]);

  // Render input area on cursor/input change
  useEffect(() => {
    if (!layoutRef.current) return;
    renderInputArea(layoutRef.current, inputText, cursorPos);
    // Move cursor to input position
    process.stdout.write(ansi.cursorTo(layoutRef.current.inputTop, 3 + cursorPos));
  }, [inputText, cursorPos]);

  // Return null - all rendering is done via escape sequences
  return null;
}

export default EscapeChatPage;
